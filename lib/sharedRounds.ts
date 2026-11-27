/** Public, deterministic demo schedule. Never suitable for real-money gaming. */
export const GAME_MODES = ['normal', 'gentil', 'plus_gentil', 'beaucoup_plus_gentil', 'mechant', 'pire', 'plus_pire', 'beaucoup_plus_pire'] as const;
export type GameMode = typeof GAME_MODES[number];
export type ModeEvent = { effectiveId: number; start: number; mode: GameMode; crashOverride?: number | null };
export type SharedRound = { id: number; start: number; flightStart: number; crashAt: number; end: number; crash: number; mode: GameMode; oneShot?: boolean };
const EPOCH = Date.UTC(2026, 0, 1);
const SIZE = 65536, WAIT_MS = 5000, CRASH_MS = 3000;
const modes = GAME_MODES;
const crashes = Object.fromEntries(modes.map(m => [m, new Float64Array(SIZE)])) as Record<GameMode, Float64Array>;
const starts = Object.fromEntries(modes.map(m => [m, new Float64Array(SIZE + 1)])) as Record<GameMode, Float64Array>;
function randomForIndex(index: number) {
  let n = (index + 0x6d2b79f5) | 0;
  n = Math.imul(n ^ (n >>> 15), 1 | n);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
for (let i = 0; i < SIZE; i++) {
  const base = Math.max(1, .97 / (1 - randomForIndex(i)));
  // Monotonic transforms preserve the long tail, including values above 1000x.
  const values: Record<GameMode, number> = { normal: base, gentil: 1 + (base - 1) * 2, plus_gentil: 1 + (base - 1) * 4, beaucoup_plus_gentil: 1 + (base - 1) * 8, mechant: 1 + (base - 1) * .5, pire: 1 + (base - 1) * .2, plus_pire: 1 + (base - 1) * .1, beaucoup_plus_pire: 1 + (base - 1) * .05 };
  for (const mode of modes) {
    crashes[mode][i] = values[mode];
    starts[mode][i + 1] = starts[mode][i] + WAIT_MS + Math.log(values[mode]) / .00006 + CRASH_MS;
  }
}
const indexOf = (id: number) => ((id % SIZE) + SIZE) % SIZE;
function offset(mode: GameMode, id: number) {
  return Math.floor(id / SIZE) * starts[mode][SIZE] + starts[mode][indexOf(id)];
}
function idAt(mode: GameMode, virtualTime: number) {
  const cycle = Math.floor(virtualTime / starts[mode][SIZE]);
  const within = virtualTime - cycle * starts[mode][SIZE];
  let low = 0, high = SIZE;
  while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (starts[mode][mid] <= within) low = mid; else high = mid; }
  return cycle * SIZE + low;
}
const baseline: ModeEvent = { effectiveId: 0, start: EPOCH, mode: 'normal' };
function anchorForId(id: number, events: ModeEvent[]) {
  return events.filter(e => e.effectiveId <= id).at(-1) ?? baseline;
}
function roundById(id: number, events: ModeEvent[]): SharedRound {
  const anchor = anchorForId(id, events);
  const start = anchor.start + offset(anchor.mode, id) - offset(anchor.mode, anchor.effectiveId);
  const flightStart = start + WAIT_MS;
  const oneShot = anchor.effectiveId === id && anchor.crashOverride != null;
  const crash = oneShot ? anchor.crashOverride! : crashes[anchor.mode][indexOf(id)];
  const crashAt = flightStart + Math.log(crash) / .00006;
  return { id, start, flightStart, crashAt, end: crashAt + CRASH_MS, crash, mode: anchor.mode, ...(oneShot ? { oneShot: true } : {}) };
}
/** Events are ordered by effectiveId and anchored to the unchanged preceding round. */
export function getSharedSchedule(now: number, events: ModeEvent[] = []): SharedRound[] {
  const anchor = events.filter(e => e.start <= now).at(-1) ?? baseline;
  const id = anchor.crashOverride != null ? anchor.effectiveId : idAt(anchor.mode, offset(anchor.mode, anchor.effectiveId) + now - anchor.start);
  return Array.from({ length: 25 }, (_, i) => roundById(id + i - 20, events));
}
