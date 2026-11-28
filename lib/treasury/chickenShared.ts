import 'server-only';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { multiplierAt, riskAt } from '../pilot-chicken/format';
import { createDemoWallet, openWager, finishWager } from './wallet';
import { TreasuryError } from './transactions';
import { chickenAction, chickenSnapshot } from './chicken';

const BETTING_MS=12000, STEP_MS=10000;
type Round={id:string;seed:string;commitment:string;phase:'betting'|'decision'|'finished';step:number;deadline:string;outcome:string|null};
type Participant={player_id:string;bet_id:string;stake:number;free:boolean;status:'playing'|'won'|'lost';step:number;chosen_step:number|null;payout:string|null};
type Action={kind:'start';amount:number;free:boolean;roundId:string}|{kind:'next'|'cash';roundId:string;step:number};
type History={id:string;multiplier:number;bet:number;payout:number;won:boolean;free:boolean};
type Legacy={phase:string;freeAvailable:boolean;history:History[]};
const commitment=(seed:string)=>createHash('sha256').update(Buffer.from(seed,'hex')).digest('hex');
// First 52 bits of HMAC-SHA256 are uniform; secret until the round closes.
function collision(seed:string,id:string,step:number){
 const bytes=createHmac('sha256',Buffer.from(seed,'hex')).update(`chicken-v1:${id}:${step}`).digest('hex');
 return parseInt(bytes.slice(0,13),16)/2**52 < riskAt(step,'Hardcore');
}
const payout=(stake:number,step:number)=>BigInt(Math.floor(stake*multiplierAt(step,'Easy'))*100);
async function round(tx:PoolClient,now:number):Promise<Round>{
 let r=(await tx.query<Round>("SELECT * FROM demo_chicken_rounds WHERE phase <> 'finished' LIMIT 1 FOR UPDATE")).rows[0];
 if(!r){const id=randomUUID(),seed=randomBytes(32).toString('hex');r=(await tx.query<Round>("INSERT INTO demo_chicken_rounds(id,seed,commitment,phase,deadline,created_at) VALUES ($1,$2,$3,'betting',$4,$5) RETURNING *",[id,seed,commitment(seed),now+BETTING_MS,now])).rows[0];}
 return r;
}
async function saveOutcome(tx:PoolClient,p:Participant,result:'won'|'lost',step:number){
 const amount=result==='won'?payout(p.stake,step):BigInt(0);
 await finishWager(tx,{playerId:p.player_id,betId:p.bet_id,operationId:randomUUID(),payout:amount});
 await tx.query('UPDATE demo_chicken_round_players SET status=$2,step=$3,payout=$4 WHERE bet_id=$1',[p.bet_id,result,step,amount.toString()]);
 const data=(await tx.query<{state:Legacy}>('SELECT state FROM demo_chicken_state WHERE player_id=$1 FOR UPDATE',[p.player_id])).rows[0]?.state;
 const history=[{id:p.bet_id,multiplier:multiplierAt(step,'Easy'),bet:p.stake,payout:Number(amount)/100,won:result==='won',free:p.free},...(data?.history??[])].slice(0,20);
 await tx.query('UPDATE demo_chicken_state SET state=jsonb_set(state,\'{history}\',$2::jsonb) WHERE player_id=$1',[p.player_id,JSON.stringify(history)]);
}
/** Process deadlines while holding the shared wallet transaction lock. */
async function advance(tx:PoolClient,now:number):Promise<Round>{
 let r=await round(tx,now);
 while(r.phase!=='finished' && Number(r.deadline)<=now){
  const deadline=Number(r.deadline);
  if(r.phase==='betting'){
   const has=(await tx.query("SELECT 1 FROM demo_chicken_round_players WHERE round_id=$1 AND status='playing' LIMIT 1",[r.id])).rowCount;
   if(!has){await tx.query("UPDATE demo_chicken_rounds SET phase='finished',outcome='empty',finished_at=$2 WHERE id=$1",[r.id,deadline]);r=await round(tx,now);continue;}
   r=(await tx.query<Round>("UPDATE demo_chicken_rounds SET phase='decision',step=1,deadline=$2 WHERE id=$1 RETURNING *",[r.id,deadline+STEP_MS])).rows[0];continue;
  }
  const players=(await tx.query<Participant>("SELECT * FROM demo_chicken_round_players WHERE round_id=$1 AND status='playing' ORDER BY player_id FOR UPDATE",[r.id])).rows;
  const hit=collision(r.seed,r.id,r.step);
  for(const p of players){
   if(p.chosen_step!==r.step)await saveOutcome(tx,p,'won',p.step);
   else if(hit)await saveOutcome(tx,p,'lost',p.step);
   else if(r.step===24)await saveOutcome(tx,p,'won',24);
   else await tx.query('UPDATE demo_chicken_round_players SET step=$2,chosen_step=NULL WHERE bet_id=$1',[p.bet_id,r.step]);
  }
  const traversed=players.some(p=>p.chosen_step===r.step);
  const survivors=traversed&&!hit&&r.step<24;
  if(!survivors){await tx.query("UPDATE demo_chicken_rounds SET phase='finished',outcome=$2,finished_at=$3 WHERE id=$1",[r.id,!traversed?'cashout':hit?'collision':'complete',deadline]);r=await round(tx,now);}
  else r=(await tx.query<Round>('UPDATE demo_chicken_rounds SET step=step+1,deadline=$2 WHERE id=$1 RETURNING *',[r.id,deadline+STEP_MS])).rows[0];
 }
 return r;
}
async function legacy(tx:PoolClient,playerId:string){return (await tx.query<{state:Legacy}>('SELECT state FROM demo_chicken_state WHERE player_id=$1',[playerId])).rows[0]?.state;}
async function view(tx:PoolClient,playerId:string,r:Round,now:number){
 const state=await legacy(tx,playerId);
 const p=(await tx.query<Participant>('SELECT * FROM demo_chicken_round_players WHERE round_id=$1 AND player_id=$2',[r.id,playerId])).rows[0];
 const last=p??(await tx.query<Participant>("SELECT * FROM demo_chicken_round_players WHERE player_id=$1 AND status<>'playing' ORDER BY (SELECT created_at FROM demo_chicken_rounds WHERE id=round_id) DESC LIMIT 1",[playerId])).rows[0];
 const balance=(await tx.query<{balance:string}>('SELECT balance FROM demo_shared_wallets WHERE player_id=$1',[playerId])).rows[0];
 // Never disclose other players' choices before the deadline.
 const list=(await tx.query<{player_id:string;username:string;stake:number;status:string;step:number;total:string}>(`SELECT p.player_id,a.username,p.stake,p.status,p.step,count(*) OVER() AS total FROM demo_chicken_round_players p JOIN demo_accounts a ON a.player_id=p.player_id WHERE p.round_id=$1 ORDER BY (p.player_id=$2) DESC,p.bet_id LIMIT 40`,[r.id,playerId])).rows;
 const previous=(await tx.query<{id:string;seed:string;commitment:string;outcome:string;step:number}>("SELECT id,seed,commitment,outcome,step FROM demo_chicken_rounds WHERE phase='finished' AND outcome<>'empty' ORDER BY finished_at DESC LIMIT 1")).rows[0]??null;
 return {balance:Number(balance.balance)/100,difficulty:'Easy',free:last?.free??false,freeAvailable:state?.freeAvailable??true,phase:last?.status==='playing'?'playing':last?.status??'idle',step:last?.step??0,stake:last?.stake??0,multiplier:multiplierAt(last?.step??0,'Easy'),history:state?.history??[],round:{id:r.id,phase:r.phase,step:r.step,deadline:Number(r.deadline),serverTime:now,commitment:r.commitment,chosen:p?.chosen_step===r.step&&r.phase==='decision',joined:!!p},playerCount:Number(list[0]?.total??0),players:list.map(x=>({name:x.player_id===playerId?'Vous':x.username.slice(0,1)+'•••',stake:x.stake,status:x.status,step:x.step})),previous};
}
export async function sharedSnapshot(tx:PoolClient,playerId:string){
 await createDemoWallet(tx,playerId,'pilot-chicken',randomUUID());
 const old=await legacy(tx,playerId);if(old?.phase==='playing')return {...await chickenSnapshot(tx,playerId),legacy:true};
 const now=Date.now(),r=await advance(tx,now);return view(tx,playerId,r,now);
}
export async function sharedAction(tx:PoolClient,playerId:string,actionId:string,action:Action){
 await createDemoWallet(tx,playerId,'pilot-chicken',randomUUID());
 const old=await legacy(tx,playerId);
 // Finish existing solo games under their original rules; new games always use shared rounds.
 if(old?.phase==='playing' && action.kind!=='start')return {...(await chickenAction(tx,playerId,actionId,{kind:action.kind}) as object),legacy:true};
 const now=Date.now(),r=await advance(tx,now);
 const prior=(await tx.query<{matches:boolean}>('SELECT request=$3::jsonb AS matches FROM demo_chicken_actions WHERE player_id=$1 AND action_id=$2',[playerId,actionId,JSON.stringify(action)])).rows[0];
 if(prior){if(!prior.matches)throw new TreasuryError('IDEMPOTENCY_CONFLICT');return view(tx,playerId,r,now);}
 if(action.roundId!==r.id)throw new TreasuryError('ROUND_CHANGED');
 if(action.kind==='start'){
  if(old?.phase==='playing')throw new TreasuryError('GAME_IN_PROGRESS');
  if(r.phase!=='betting'||now>=Number(r.deadline))throw new TreasuryError('BETTING_CLOSED');
  if(!Number.isSafeInteger(action.amount)||action.amount<100||action.amount>100000||typeof action.free!=='boolean')throw new TreasuryError('INVALID_BET');
  if(action.free&&old?.freeAvailable===false)throw new TreasuryError('FREE_USED');
  const exists=await tx.query('SELECT 1 FROM demo_chicken_round_players WHERE round_id=$1 AND player_id=$2',[r.id,playerId]);if(exists.rowCount)throw new TreasuryError('GAME_IN_PROGRESS');
  const stake=action.free?500:action.amount,betId=randomUUID(),funded=action.free?BigInt(0):BigInt(stake*100);
  await openWager(tx,{playerId,game:'pilot-chicken',betId,operationId:actionId,stake:BigInt(stake*100),fundedStake:funded});
  if(Date.now()>=Number(r.deadline))throw new TreasuryError('BETTING_CLOSED');
  await tx.query("INSERT INTO demo_chicken_round_players(round_id,player_id,bet_id,stake,free,status) VALUES($1,$2,$3,$4,$5,'playing')",[r.id,playerId,betId,stake,action.free]);
  const state=old??{phase:'idle',freeAvailable:true,history:[]};
  await tx.query('INSERT INTO demo_chicken_state(player_id,state) VALUES($1,$2::jsonb) ON CONFLICT(player_id) DO UPDATE SET state=$2::jsonb',[playerId,JSON.stringify({...state,freeAvailable:action.free?false:state.freeAvailable})]);
 }else{
  if(r.phase!=='decision'||action.step!==r.step||now>=Number(r.deadline))throw new TreasuryError('STEP_CHANGED');
  const p=(await tx.query<Participant>("SELECT * FROM demo_chicken_round_players WHERE round_id=$1 AND player_id=$2 FOR UPDATE",[r.id,playerId])).rows[0];
  if(!p||p.status!=='playing')throw new TreasuryError('NO_ACTIVE_GAME');
  if(Date.now()>=Number(r.deadline))throw new TreasuryError('STEP_CHANGED');
  if(p.chosen_step===r.step)throw new TreasuryError('CHOICE_LOCKED');
  if(action.kind==='next')await tx.query('UPDATE demo_chicken_round_players SET chosen_step=$2 WHERE bet_id=$1',[p.bet_id,r.step]);
  else await saveOutcome(tx,p,'won',p.step);
 }
 const response=await view(tx,playerId,r,Date.now());
 await tx.query('INSERT INTO demo_chicken_actions(player_id,action_id,request,response) VALUES($1,$2,$3::jsonb,$4::jsonb)',[playerId,actionId,JSON.stringify(action),JSON.stringify(response)]);
 return response;
}
