export const MIN_BET = 200;
export const MAX_BET = 10_000;
export const QUICK_BETS = [200, 1_000, 5_000, 10_000] as const;

export function isValidBetAmount(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_BET && value <= MAX_BET;
}
