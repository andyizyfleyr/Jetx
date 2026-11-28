import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../lib/treasury/risk.ts';
const F = 100n;
const snapshot = (patch = {}) => ({ equity: 100000n * F, committed: 0n, playerCommitted: 0n, hourlyGrossLoss: 0n, ...patch });
test('30 percent reserve and one percent single-bet cap', () => {
  const result = assessRisk(snapshot(), 0n, 1000n * F);
  assert.equal(result.reserve, 30000n * F); assert.equal(result.capacity, 70000n * F); assert.equal(result.allowed, true);
  assert.equal(assessRisk(snapshot(), 0n, 1000n * F + 1n).reason, 'bet_limit');
});
test('player and hourly limits include other outstanding commitments', () => {
  assert.equal(assessRisk(snapshot({ committed: 3000n * F, playerCommitted: 3000n * F }), 0n, 1n).reason, 'player_limit');
  assert.equal(assessRisk(snapshot({ committed: 9900n * F, hourlyGrossLoss: 100n * F }), 0n, 1n).reason, 'hourly_limit');
});
test('replacement does not double count and reductions never block a promise', () => {
  const s = snapshot({ committed: 1000n * F, playerCommitted: 1000n * F, hourlyGrossLoss: 20000n * F });
  assert.equal(assessRisk(s, 1000n * F, 999n * F).allowed, true);
  assert.equal(assessRisk(s, 1000n * F, 1001n * F).reason, 'bet_limit');
});
test('round reserve upwards and reject invalid snapshots', () => {
  assert.equal(assessRisk(snapshot({ equity: 1n }), 0n, 0n).reserve, 1n);
  assert.throws(() => assessRisk(snapshot(), 1n, 0n), RangeError);
  assert.throws(() => assessRisk(snapshot({ equity: -1n }), 0n, 0n), RangeError);
});
