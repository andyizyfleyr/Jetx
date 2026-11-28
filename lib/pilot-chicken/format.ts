export const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} F`;
export const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Hardcore';
export const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Hardcore'];
// Each crossing has an independent risk, increasing as the runway progresses.
export const risks: Record<Difficulty, number> = { Easy: .12, Medium: .20, Hard: .28, Hardcore: .36 };
export function riskAt(step: number, difficulty: Difficulty) {
  const crossing = Math.max(1, Math.min(24, Math.floor(step)));
  return Math.min(.5, risks[difficulty] + (crossing - 1) * .005);
}
export function multiplierAt(step: number, difficulty: Difficulty) {
  if (step <= 0) return 1;
  const crossings = Math.min(24, Math.floor(step));
  let survival = 1;
  for (let i = 1; i <= crossings; i++) survival *= 1 - riskAt(i, difficulty);
  // A fixed margin keeps the reward proportional to the cumulative risk.
  return Math.round((.96 / survival) * 100) / 100;
}
