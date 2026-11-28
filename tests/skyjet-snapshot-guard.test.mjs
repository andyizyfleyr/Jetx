import test from 'node:test';
import assert from 'node:assert/strict';
import { SkySnapshotGuard } from '../lib/skySnapshotGuard.ts';
import { displayBetStatus } from '../lib/skyjetBetDisplay.ts';

test('un ancien relevé ne remplace pas une mise acceptée pendant le vol', () => {
 const guard = new SkySnapshotGuard();
 const before = guard.capture();
 guard.beginAction();
 const during = guard.capture();
 assert.equal(guard.canApply(before), false);
 assert.equal(guard.canApply(during), false);
 guard.endAction();
 assert.equal(guard.canApply(during), false);
 assert.equal(guard.canApply(guard.capture()), true);
 const acceptedBet = { status: 'queued', roundId: 7 };
 assert.equal(displayBetStatus(acceptedBet, 'FLYING', 7), 'active');
});
test('la resynchronisation après erreur reste possible pendant une action', () => {
 const guard = new SkySnapshotGuard();
 guard.beginAction();
 assert.equal(guard.canApply(guard.capture(), true), true);
 guard.endAction();
});
