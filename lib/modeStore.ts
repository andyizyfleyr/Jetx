import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { randomInt } from 'node:crypto';
import { getSharedSchedule, type GameMode, type ModeEvent } from './sharedRounds';

let pool: Pool | undefined;
let schemaReady = false;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
  return pool;
}
async function withSchedule<T>(callback: (client: PoolClient, events: ModeEvent[], now: number) => Promise<T>): Promise<T> {
  const db = getPool();
  if (!db) throw new Error('DATABASE_NOT_CONFIGURED');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '3s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    // Serialize reads and writes so no client sees a half-written transition.
    await client.query('SELECT pg_advisory_xact_lock($1)', [194851277]);
    if (!schemaReady) {
    await client.query(`CREATE TABLE IF NOT EXISTS skyjet_mode_events (
      effective_id bigint PRIMARY KEY, start_ms double precision NOT NULL,
      mode text NOT NULL CHECK (mode IN ('normal','gentil','mechant','pire'))
    )`);
    // Upgrade the original four-mode constraint without losing existing events.
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'skyjet_mode_events'::regclass AND conname = 'skyjet_mode_events_mode_check_v2') THEN
        ALTER TABLE skyjet_mode_events DROP CONSTRAINT IF EXISTS skyjet_mode_events_mode_check;
        ALTER TABLE skyjet_mode_events ADD CONSTRAINT skyjet_mode_events_mode_check_v2 CHECK (mode IN ('normal','gentil','plus_gentil','beaucoup_plus_gentil','mechant','pire','plus_pire','beaucoup_plus_pire'));
      END IF;
    END $$`);
    await client.query('ALTER TABLE skyjet_mode_events ADD COLUMN IF NOT EXISTS crash_override double precision');
    }
    const rows = await client.query<{ effective_id: string; start_ms: number; mode: GameMode; crash_override: number | null }>('SELECT effective_id, start_ms, mode, crash_override FROM skyjet_mode_events ORDER BY effective_id');
    const events = rows.rows.map(row => ({ effectiveId: Number(row.effective_id), start: Number(row.start_ms), mode: row.mode, crashOverride: row.crash_override == null ? null : Number(row.crash_override) }));
    const result = await callback(client, events, Date.now());
    await client.query('COMMIT');
    schemaReady = true;
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function readSchedule() {
  if (!getPool()) {
    const serverTime = Date.now();
    return { serverTime, rounds: getSharedSchedule(serverTime), controlsAvailable: false, scheduled: null };
  }
  return withSchedule(async (_client, events, serverTime) => {
    const rounds = getSharedSchedule(serverTime, events);
    const current = rounds.find(r => r.start <= serverTime && serverTime < r.end);
    return { serverTime, rounds, controlsAvailable: true, scheduled: events.filter(e => current && e.effectiveId > current.id).at(-1) ?? null };
  });
}

/** Read the schedule while holding the same lock as mode changes. Call inside a transaction. */
export async function readScheduleLocked(client: PoolClient) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [194851277]);
  const rows = await client.query<{ effective_id: string; start_ms: number; mode: GameMode; crash_override: number | null }>('SELECT effective_id, start_ms, mode, crash_override FROM skyjet_mode_events ORDER BY effective_id');
  const events = rows.rows.map(row => ({ effectiveId:Number(row.effective_id), start:Number(row.start_ms), mode:row.mode, crashOverride:row.crash_override == null ? null : Number(row.crash_override) }));
  const now=Date.now();
  return { now, rounds:getSharedSchedule(now, events) };
}
// Do not reschedule any round that already has accepted wagers. This is read
// under the schedule lock also held by SkyJet while accepting new wagers.
async function lastCommittedRound(client: PoolClient): Promise<number> {
  const exists = await client.query<{name:string|null}>("SELECT to_regclass('demo_skyjet_bets')::text AS name");
  if (!exists.rows[0].name) return -Infinity;
  const result = await client.query<{id:string|null}>("SELECT max(round_id) AS id FROM demo_skyjet_bets WHERE status='open'");
  return result.rows[0].id === null ? -Infinity : Number(result.rows[0].id);
}

export async function changeMode(mode: GameMode) {
  return withSchedule(async (client, events, now) => {
    const rounds = getSharedSchedule(now, events);
    const current = rounds.find(r => r.start <= now && now < r.end);
    if (!current) throw new Error('NO_CURRENT_ROUND');
    // Keep a short publication window for clients to fetch the new schedule.
    // Very short current rounds may make the change take effect one round later.
    const committed = await lastCommittedRound(client);
    const target = rounds.find(r => r.id > current.id && r.id > committed && r.start >= now + 8000);
    if (!target) throw new Error('NO_FUTURE_ROUND');
    const previous = rounds.find(r => r.id === target.id - 1);
    if (!previous) throw new Error('NO_PREVIOUS_ROUND');
    await client.query('DELETE FROM skyjet_mode_events WHERE effective_id >= $1', [target.id]);
    if (mode !== previous.mode || previous.oneShot) await client.query('INSERT INTO skyjet_mode_events (effective_id, start_ms, mode) VALUES ($1, $2, $3)', [target.id, target.start, mode]);
    return { effectiveId: target.id, mode };
  });
}

/** Program one shared result, then restore the mode that would have applied. */
export async function scheduleRandom(kind: 'grand_aleatoire' | 'petit_aleatoire') {
  return withSchedule(async (client, events, now) => {
    const rounds = getSharedSchedule(now, events);
    const current = rounds.find(r => r.start <= now && now < r.end);
    const committed = await lastCommittedRound(client);
    const target = rounds.find(r => current && r.id > current.id && r.id > committed && r.start >= now + 8000);
    if (!target) throw new Error('NO_FUTURE_ROUND');
    const crash = kind === 'grand_aleatoire' ? randomInt(10000, 100001) / 100 : randomInt(101, 201) / 100;
    const end = target.start + 5000 + Math.log(crash) / .00006 + 3000;
    // Replace any future selection atomically; retain the mode scheduled for this round.
    await client.query('DELETE FROM skyjet_mode_events WHERE effective_id >= $1', [target.id]);
    await client.query('INSERT INTO skyjet_mode_events (effective_id, start_ms, mode, crash_override) VALUES ($1, $2, $3, $4)', [target.id, target.start, target.mode, crash]);
    await client.query('INSERT INTO skyjet_mode_events (effective_id, start_ms, mode) VALUES ($1, $2, $3)', [target.id + 1, end, target.mode]);
    return { effectiveId: target.id, mode: target.mode, crash };
  });
}
