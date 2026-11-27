/** Sample the demo crash distribution without imposing an artificial ceiling. */
export function drawCrashPoint(random: () => number = Math.random): number {
  return Math.max(1, 0.97 / (1 - random()));
}
