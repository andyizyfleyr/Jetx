/**
 * Fictitious treasury policy. All quantities are integer hundredths of F.
 * This pure calculation is NOT a treasury: callers must serialize reservations
 * and settlements in a durable server-side transaction before using it.
 */
export type RiskSnapshot = {
  equity: bigint;
  committed: bigint;
  playerCommitted: bigint;
  hourlyGrossLoss: bigint;
};
export type RiskDecision = {
  allowed: boolean;
  reserve: bigint;
  capacity: bigint;
  perBetLimit: bigint;
  playerLimit: bigint;
  hourlyLimit: bigint;
  reason: 'ok' | 'bet_limit' | 'player_limit' | 'hourly_limit' | 'capacity';
};

const ceilDiv = (a: bigint, b: bigint) => (a + b - BigInt(1)) / b;

/** Check the total exposure after replacing an existing reservation.
 * Hourly gross loss is never offset by wins, and outstanding commitments count
 * toward the hour limit as a conservative worst case. Settlements already owed
 * must never be refused even if limits have since fallen.
 */
export function assessRisk(snapshot: RiskSnapshot, existing: bigint, proposed: bigint): RiskDecision {
  const { equity, committed, playerCommitted, hourlyGrossLoss } = snapshot;
  if ([equity, committed, playerCommitted, hourlyGrossLoss, existing, proposed].some(v => v < BigInt(0)) || existing > committed || existing > playerCommitted) {
    throw new RangeError('Invalid treasury snapshot');
  }
  const reserve = ceilDiv(equity * BigInt(30), BigInt(100));
  const capacity = equity - reserve;
  const perBetLimit = equity / BigInt(100);
  const playerLimit = equity * BigInt(3) / BigInt(100);
  const hourlyLimit = equity * BigInt(10) / BigInt(100);
  const totalAfter = committed - existing + proposed;
  const playerAfter = playerCommitted - existing + proposed;
  // Reducing an existing commitment is always allowed: it cannot increase risk.
  let reason: RiskDecision['reason'] = 'ok';
  if (proposed > existing) {
    if (proposed > perBetLimit) reason = 'bet_limit';
    else if (playerAfter > playerLimit) reason = 'player_limit';
    else if (hourlyGrossLoss + totalAfter > hourlyLimit) reason = 'hourly_limit';
    else if (totalAfter > capacity) reason = 'capacity';
  }
  return { allowed: reason === 'ok', reserve, capacity, perBetLimit, playerLimit, hourlyLimit, reason };
}
