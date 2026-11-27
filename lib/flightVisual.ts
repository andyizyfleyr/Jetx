/** The game grows as exp(0.06 * seconds); recover one shared flight timeline
 * from the multiplier so the aircraft and all scenery stay in sync. */
export function flightVisual(multiplier: number, animated: boolean) {
  const seconds = animated ? Math.max(0, Math.log(Math.max(1, multiplier)) / 0.06) : 0;
  // Integrate the multiplier as speed, with a ceiling to keep very large
  // multipliers readable and avoid flashing or unbounded movement.
  const maxSpeed = 8;
  const capTime = Math.log(maxSpeed) / 0.06;
  const distance = animated
    ? seconds <= capTime
      ? Math.expm1(seconds * 0.06) / 0.06
      : (maxSpeed - 1) / 0.06 + (seconds - capTime) * maxSpeed
    : 0;
  const ascent = 1 - Math.exp(-seconds / 18);
  const entrance = 1 - Math.exp(-seconds / 6);
  // A gentle arc across the scene, driven by the same clock as the clouds.
  return {
    seconds,
    distance,
    ascent,
    entrance,
    x: .35 + .22 * entrance + .02 * ascent + Math.sin(distance * .9) * .008,
    y: .41 - .065 * entrance - .015 * ascent + Math.sin(distance * 1.25) * .008,
    rotation: -.10 - .10 * entrance - .035 * Math.sin(distance * .85),
  };
}
