import 'server-only';
import type { Pool, PoolClient } from 'pg';
import { assessRisk } from './risk';

/** Internal primitives for fictitious funds only. These are not endpoints.
 * The caller must authenticate the actor and perform the game and wallet writes
 * inside the same transaction. Never accept risk or settlement values from a client.
 * Apply db/migrations/001_fictitious_treasury.sql before use.
 */
type GameName = 'skyjet' | 'pilot-chicken';
type Reservation = { bet_id: string; player_id: string; game: GameName; risk: string; status: 'open' | 'settled' | 'cancelled' };
export class TreasuryError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export async function withTreasuryTransaction<T>(pool: Pool, execute: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    // This single row serializes every treasury and wallet/game operation that
    // participates in this protocol, across both games and server instances.
    const locked = await client.query('SELECT id FROM demo_treasury WHERE id = 1 FOR UPDATE');
    if (locked.rowCount !== 1) throw new TreasuryError('TREASURY_NOT_INITIALIZED');
    const result = await execute(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function getReservation(tx: PoolClient, betId: string): Promise<Reservation | undefined> {
  const { rows } = await tx.query<Reservation>('SELECT bet_id, player_id, game, risk, status FROM demo_risk_reservations WHERE bet_id = $1 FOR UPDATE', [betId]);
  return rows[0];
}

/** Call only inside withTreasuryTransaction, BEFORE accepting a game action. */
export async function reserveRisk(tx: PoolClient, args: { betId: string; playerId: string; game: GameName; proposedRisk: bigint; operationId: string }) {
  if (args.proposedRisk < BigInt(0)) throw new TreasuryError('INVALID_RISK');
  const existing = await getReservation(tx, args.betId);
  if (existing && (existing.player_id !== args.playerId || existing.game !== args.game || existing.status !== 'open')) throw new TreasuryError('INVALID_RESERVATION');
  const prior = await tx.query<{ bet_id: string; kind: string; risk_after: string }>('SELECT bet_id, kind, risk_after FROM demo_treasury_events WHERE operation_id = $1', [args.operationId]);
  if (prior.rows[0]) {
    const e = prior.rows[0];
    if (e.bet_id !== args.betId || e.kind !== 'reserve' || BigInt(e.risk_after) !== args.proposedRisk) throw new TreasuryError('IDEMPOTENCY_CONFLICT');
    return { applied: false };
  }
  const { rows: [s] } = await tx.query<{ equity: string; committed: string; player_committed: string; hourly_loss: string }>(`
    SELECT t.equity,
      COALESCE((SELECT sum(risk) FROM demo_risk_reservations WHERE status = 'open'), 0) AS committed,
      COALESCE((SELECT sum(risk) FROM demo_risk_reservations WHERE status = 'open' AND player_id = $1), 0) AS player_committed,
      COALESCE((SELECT sum(GREATEST(house_loss, 0)) FROM demo_treasury_events WHERE kind = 'settle' AND created_at > now() - interval '1 hour'), 0) AS hourly_loss
    FROM demo_treasury t WHERE t.id = 1`, [args.playerId]);
  const decision = assessRisk({ equity: BigInt(s.equity), committed: BigInt(s.committed), playerCommitted: BigInt(s.player_committed), hourlyGrossLoss: BigInt(s.hourly_loss) }, existing ? BigInt(existing.risk) : BigInt(0), args.proposedRisk);
  if (!decision.allowed) throw new TreasuryError(`RISK_${decision.reason.toUpperCase()}`);
  await tx.query(`INSERT INTO demo_risk_reservations (bet_id, player_id, game, risk, status) VALUES ($1,$2,$3,$4,'open')
    ON CONFLICT (bet_id) DO UPDATE SET risk = EXCLUDED.risk, updated_at = now()`, [args.betId, args.playerId, args.game, args.proposedRisk.toString()]);
  await tx.query("INSERT INTO demo_treasury_events (operation_id, bet_id, kind, risk_after, equity_after) VALUES ($1,$2,'reserve',$3,$4)", [args.operationId, args.betId, args.proposedRisk.toString(), s.equity]);
  return { applied: true };
}

/** Net loss is payout minus funded stake; free bets have funded stake zero.
 * The caller must validate the game outcome and credit/debit its wallet in the
 * SAME transaction. Cancellation is separately recorded and never alters equity.
 */
export async function closeRisk(tx: PoolClient, args: { betId: string; playerId: string; operationId: string; houseLoss: bigint; cancel?: boolean }) {
  const bet = await getReservation(tx, args.betId);
  if (!bet || bet.player_id !== args.playerId) throw new TreasuryError('INVALID_RESERVATION');
  const prior = await tx.query<{ bet_id: string; kind: string; house_loss: string }>('SELECT bet_id, kind, house_loss FROM demo_treasury_events WHERE operation_id = $1', [args.operationId]);
  const kind = args.cancel ? 'cancel' : 'settle';
  if (prior.rows[0]) {
    const e = prior.rows[0];
    if (e.bet_id !== args.betId || e.kind !== kind || BigInt(e.house_loss) !== args.houseLoss) throw new TreasuryError('IDEMPOTENCY_CONFLICT');
    return { applied: false };
  }
  if (bet.status !== 'open' || (args.cancel && args.houseLoss !== BigInt(0)) || args.houseLoss > BigInt(bet.risk)) throw new TreasuryError('INVALID_SETTLEMENT');
  const equity = await tx.query<{ equity: string }>('UPDATE demo_treasury SET equity = equity - $1::bigint WHERE id = 1 AND equity - $1::bigint >= 0 RETURNING equity', [args.houseLoss.toString()]);
  if (!equity.rows[0]) throw new TreasuryError('INSUFFICIENT_EQUITY');
  await tx.query('UPDATE demo_risk_reservations SET status = $2, risk = 0, updated_at = now() WHERE bet_id = $1', [args.betId, args.cancel ? 'cancelled' : 'settled']);
  await tx.query('INSERT INTO demo_treasury_events (operation_id, bet_id, kind, house_loss, risk_after, equity_after) VALUES ($1,$2,$3,$4,0,$5)', [args.operationId, args.betId, kind, args.houseLoss.toString(), equity.rows[0].equity]);
  return { applied: true };
}
