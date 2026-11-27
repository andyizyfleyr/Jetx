/** The game grows as exp(0.06 * seconds); recover one shared flight timeline
 * from the multiplier so the aircraft and all scenery stay in sync. */
export function flightVisual(multiplier: number, animated: boolean) {
  const seconds = animated ? Math.max(0, Math.log(Math.max(1, multiplier)) / 0.06) : 0;
  return {
    seconds,
    ascent: 1 - Math.exp(-seconds / 18),
    entrance: 1 - Math.exp(-seconds / 1.3),
  };
}
