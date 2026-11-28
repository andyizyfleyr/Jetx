import test from 'node:test';
import assert from 'node:assert/strict';
import {chickenInstruction} from '../lib/pilot-chicken/roundMessage.ts';
const round=(phase,joined=false,chosen=false)=>({phase,joined,chosen,step:3});
test('explains what players can do during each phase',()=>{
 assert.match(chickenInstruction(false,false,'idle').title,/Connexion/);
 assert.match(chickenInstruction(true,false,'idle',round('betting')).detail,/Miser/);
 assert.equal(chickenInstruction(true,false,'playing',round('betting',true)).title,'Mise enregistrée');
 assert.match(chickenInstruction(true,false,'idle',round('decision')).detail,/prochaine manche/);
 assert.match(chickenInstruction(true,false,'playing',round('decision',true)).detail,/Sans réponse/);
 assert.match(chickenInstruction(true,false,'playing',round('decision',true,true)).detail,/compte à rebours/);
 assert.match(chickenInstruction(true,false,'won',round('decision',true)).title,/terminée/);
});
