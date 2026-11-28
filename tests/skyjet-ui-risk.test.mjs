import test from 'node:test';
import assert from 'node:assert/strict';
import { displayBetStatus } from '../lib/skyjetBetDisplay.ts';
import { skyjetProfitLimit } from '../lib/treasury/skyjetRisk.ts';

test('buttons follow the current flight phase without modifying server bets',()=>{
 const bet={status:'queued',roundId:7};
 assert.equal(displayBetStatus(bet,'WAITING',7),'queued');
 assert.equal(displayBetStatus(bet,'FLYING',7),'active');
 assert.equal(displayBetStatus(bet,'CRASHED',7),'settling');
 assert.equal(displayBetStatus(bet,'WAITING',8),'settling');
 assert.equal(bet.status,'queued');
});
test('auto cashout reserves only its worst-case profit, bounded by house cap',()=>{
 assert.equal(skyjetProfitLimit(20000n,100000n,null),100000n);
 assert.equal(skyjetProfitLimit(20000n,100000n,1.1),2000n);
 assert.equal(skyjetProfitLimit(20000n,100000n,20),100000n);
 assert.ok(skyjetProfitLimit(99999n,100000n,1.33)>=BigInt(Math.floor(99999*1.33)-99999));
});
