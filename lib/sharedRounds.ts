/**
 * Shared, deterministic demo schedule. Every stateless server instance computes
 * the same rounds from UTC time. This public schedule is predictable and must
 * never be used for real-money gaming or treated as provably fair randomness.
 */
export type SharedRound = { id: number; start: number; flightStart: number; crashAt: number; end: number; crash: number };
const EPOCH = Date.UTC(2026, 0, 1);
const SIZE = 65536;
const WAIT_MS = 5000;
const CRASH_MS = 3000;
const starts = new Float64Array(SIZE + 1);
const crashes = new Float64Array(SIZE);
function randomForIndex(index: number) {
  let n = (index + 0x6d2b79f5) | 0;
  n = Math.imul(n ^ (n >>> 15), 1 | n);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
for (let i = 0; i < SIZE; i++) {
  crashes[i] = Math.max(1, .97 / (1 - randomForIndex(i)));
  starts[i + 1] = starts[i] + WAIT_MS + Math.log(crashes[i]) / .00006 + CRASH_MS;
}
const period = starts[SIZE];
function makeRound(cycle: number, index: number): SharedRound {
  const start = EPOCH + cycle * period + starts[index];
  const flightStart = start + WAIT_MS;
  const crashAt = flightStart + Math.log(crashes[index]) / .00006;
  return { id: cycle * SIZE + index, start, flightStart, crashAt, end: crashAt + CRASH_MS, crash: crashes[index] };
}
function roundById(id: number): SharedRound {
  const cycle = Math.floor(id / SIZE);
  const index = ((id % SIZE) + SIZE) % SIZE;
  return makeRound(cycle, index);
}
/** Includes previous rounds for reconnecting clients and future rounds for smooth transitions. */
export function getSharedSchedule(now: number): SharedRound[] {
  const cycle = Math.floor((now - EPOCH) / period);
  const offset = now - EPOCH - cycle * period;
  let low = 0, high = SIZE;
  while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (starts[mid] <= offset) low = mid; else high = mid; }
  const id = cycle * SIZE + low;
  return Array.from({ length: 25 }, (_, i) => roundById(id + i - 20));
}
