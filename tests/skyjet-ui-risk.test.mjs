import test from 'node:test';
import assert from 'node:assert/strict';
import { displayBetStatus } from '../lib/skyjetBetDisplay.ts';

test('buttons follow the current flight phase without modifying server bets',()=>{
 const bet={status:'queued',roundId:7};
 assert.equal(displayBetStatus(bet,'WAITING',7),'queued');
 assert.equal(displayBetStatus(bet,'FLYING',7),'active');
 assert.equal(displayBetStatus(bet,'CRASHED',7),'settling');
 assert.equal(displayBetStatus(bet,'WAITING',8),'settling');
 assert.equal(bet.status,'queued');
});
test('future bets stay cancellable during flight and after crash',()=>{
 const next={status:'queued',roundId:8};
 assert.equal(displayBetStatus(next,'FLYING',7),'queued');
 assert.equal(displayBetStatus(next,'CRASHED',7),'queued');
 assert.equal(displayBetStatus(next,'WAITING',8),'queued');
 assert.equal(displayBetStatus(next,'FLYING',8),'active');
});
