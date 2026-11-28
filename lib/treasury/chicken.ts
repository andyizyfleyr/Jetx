import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { multiplierAt, riskAt, difficulties, type Difficulty } from '../pilot-chicken/format';
import { createDemoWallet, openWager, finishWager } from './wallet';
import { TreasuryError } from './transactions';

type State = { phase:'idle'|'playing'|'won'|'lost'; step:number; stake:number; multiplier:number; difficulty:Difficulty; oddsDifficulty?:Difficulty; free:boolean; freeAvailable:boolean; betId:string|null; history: {id:string; multiplier:number; bet:number; payout:number; won:boolean; free:boolean}[] };
type Action = {kind:'start'; amount:number; difficulty:Difficulty; oddsDifficulty?:Difficulty; free:boolean} | {kind:'next'|'cash'};
const initial: State = {phase:'idle',step:0,stake:0,multiplier:1,difficulty:'Hardcore',oddsDifficulty:'Easy',free:false,freeAvailable:true,betId:null,history:[]};
async function read(tx:PoolClient,playerId:string) {
 const {rows} = await tx.query<{state:State}>('SELECT state FROM demo_chicken_state WHERE player_id=$1 FOR UPDATE',[playerId]);
 return rows[0]?.state ? {...initial,...rows[0].state,oddsDifficulty:rows[0].state.oddsDifficulty ?? (rows[0].state.phase==='playing'?rows[0].state.difficulty:'Easy')} : initial;
}
async function view(tx:PoolClient,playerId:string,state:State){const {rows}=await tx.query<{balance:string}>('SELECT balance FROM demo_shared_wallets WHERE player_id=$1',[playerId]);return {...state,balance:Number(rows[0].balance)/100};}
export async function chickenSnapshot(tx:PoolClient,playerId:string){await createDemoWallet(tx,playerId,'pilot-chicken',randomUUID()); return view(tx,playerId,await read(tx,playerId));}
export async function chickenAction(tx:PoolClient,playerId:string,actionId:string,action:Action){
 const prior=await tx.query<{request:Action;response:unknown}>('SELECT request,response FROM demo_chicken_actions WHERE player_id=$1 AND action_id=$2',[playerId,actionId]);
 if(prior.rows[0]){if(prior.rows[0].request.kind!==action.kind || (action.kind==='start' && (prior.rows[0].request.kind!=='start' || prior.rows[0].request.amount!==action.amount || prior.rows[0].request.difficulty!==action.difficulty || prior.rows[0].request.free!==action.free))) throw new TreasuryError('IDEMPOTENCY_CONFLICT');return prior.rows[0].response;}
 await createDemoWallet(tx,playerId,'pilot-chicken',randomUUID());let state=await read(tx,playerId);
 if(action.kind==='start'){
  if(state.phase==='playing')throw new TreasuryError('GAME_IN_PROGRESS');
  if(!Number.isSafeInteger(action.amount)||action.amount<100||action.amount>100000||!difficulties.includes(action.difficulty)||typeof action.free!=='boolean') throw new TreasuryError('INVALID_BET');
  if(action.free&&!state.freeAvailable) throw new TreasuryError('FREE_USED');
  const stake=action.free?500:action.amount,betId=randomUUID(),funded=action.free?BigInt(0):BigInt(stake*100);
  await openWager(tx,{playerId,game:'pilot-chicken',betId,operationId:actionId,stake:BigInt(stake*100),fundedStake:funded});
  state={...state,phase:'playing',step:0,stake,multiplier:1,difficulty:'Hardcore',oddsDifficulty:'Easy',free:action.free,freeAvailable:action.free?false:state.freeAvailable,betId};
 } else {
  if(state.phase!=='playing'||!state.betId)throw new TreasuryError('NO_ACTIVE_GAME');
  const payoutAt=(m:number)=>Math.floor(state.stake*m)*100;
  if(action.kind==='next'){
   const step=state.step+1,multiplier=multiplierAt(step,state.oddsDifficulty??state.difficulty),payout=payoutAt(multiplier);
   if(randomInt(1000000)<Math.round(riskAt(step,state.difficulty)*1000000)){
    await finishWager(tx,{playerId,betId:state.betId,operationId:randomUUID(),payout:BigInt(0)});
    const history=[{id:state.betId,multiplier:state.multiplier,bet:state.stake,payout:0,won:false,free:state.free},...state.history].slice(0,20);
    state={...state,phase:'lost',history};
   }else if(step===24){
    await finishWager(tx,{playerId,betId:state.betId,operationId:randomUUID(),payout:BigInt(payout)});
    const history=[{id:state.betId,multiplier,bet:state.stake,payout:payout/100,won:true,free:state.free},...state.history].slice(0,20);
    state={...state,phase:'won',step,multiplier,history};
   }else state={...state,step,multiplier};
  }else if(action.kind==='cash'){
   const payout=payoutAt(state.multiplier);await finishWager(tx,{playerId,betId:state.betId,operationId:actionId,payout:BigInt(payout)});
   const history=[{id:state.betId,multiplier:state.multiplier,bet:state.stake,payout:payout/100,won:true,free:state.free},...state.history].slice(0,20);
   state={...state,phase:'won',history};
  }else throw new TreasuryError('INVALID_ACTION');
 }
 await tx.query('INSERT INTO demo_chicken_state(player_id,state) VALUES($1,$2::jsonb) ON CONFLICT(player_id) DO UPDATE SET state=EXCLUDED.state',[playerId,JSON.stringify(state)]);
 const response=await view(tx,playerId,state);
 await tx.query('INSERT INTO demo_chicken_actions(player_id,action_id,request,response) VALUES($1,$2,$3::jsonb,$4::jsonb)',[playerId,actionId,JSON.stringify(action),JSON.stringify(response)]);
 return response;
}
