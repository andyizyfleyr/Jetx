export const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} F`;
export const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Hardcore';
export const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Hardcore'];
export const risks: Record<Difficulty, number> = { Easy: .04, Medium: .10, Hard: .20, Hardcore: .35 };
const early = [1.05, 1.10, 1.20, 1.30, 1.50, 1.80];
export function multiplierAt(step: number, difficulty: Difficulty) {
  if (step <= 0) return 1;
  const index = Math.min(24, Math.floor(step));
  const base = index <= 6 ? early[index - 1] : 1.8 * Math.pow(24 / 1.8, (index - 6) / 18);
  const exponent = { Easy: 1, Medium: 1.30, Hard: 1.65, Hardcore: 2.1 }[difficulty];
  return Math.round(Math.pow(base, exponent) * 100) / 100;
}
