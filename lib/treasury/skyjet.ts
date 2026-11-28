import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { SharedRound } from '../sharedRounds';
import { createDemoWallet, openWager, finishWager } from './wallet';
import { readRiskSnapshot, TreasuryError } from './transactions';
import { remainingRisk } from './risk';
import { skyjetProfitLimit } from './skyjetRisk';

type Bet = {bet_id:string;player_id:string;slot:number;round_id:string;flight_start:number;crash_at:number;crash:number;cap_payout:string;auto_target:number|null;stake:string;status:string};
type Action = {kind:'place';slot:number;amount:number;autoTarget:number|null} | {kind:'cancel'|'cash';slot:number};
async function openBets(tx:PoolClient,playerId?:string){return (await tx.query<Bet>(`SELECT b.*,w.stake FROM demo_skyjet_bets b JOIN demo_wagers w ON w.bet_id=b.bet_id WHERE b.status='open' ${playerId?'AND b.player_id=$1':''} ORDER BY b.created_at`,playerId?[playerId]:[])).rows;}
// Resolve caps, auto cashouts and crashes for every player, even disconnected ones.
// Called under the shared treasury lock before any account operation.
async function settleDue(tx:PoolClient,now:number){
 for(const b of await openBets(tx)){
  const stake=Number(b.stake),cap=Number(b.cap_payout),capMultiplier=cap/stake;
  const target=b.auto_target===null?capMultiplier:Math.min(b.auto_target,capMultiplier);
  const targetTime=b.flight_start+Math.log(target)/.00006;
  let payout:number|undefined;
  if(targetTime < b.crash_at && now>=targetTime) payout=Math.min(cap,Math.floor(stake*target));
  else if(now>=b.crash_at) payout=0;
  if(payout===undefined)continue;
  await finishWager(tx,{playerId:b.player_id,betId:b.bet_id,operationId:randomUUID(),payout:BigInt(payout)});
  await tx.query("UPDATE demo_skyjet_bets SET status='settled' WHERE bet_id=$1",[b.bet_id]);
 }
}
async function snapshot(tx:PoolClient,playerId:string,now:number,round?:SharedRound){
 const wallet=await tx.query<{balance:string}>('SELECT balance FROM demo_shared_wallets WHERE player_id=$1',[playerId]);
 const bets=(await openBets(tx,playerId)).map(b=>({slot:b.slot,amount:Number(b.stake)/100,roundId:Number(b.round_id),status:now<b.flight_start?'queued':'active',capPayout:Number(b.cap_payout)/100}));
 const risk=await readRiskSnapshot(tx,playerId);
 const used=round && now>=round.flightStart && now<round.crashAt ? await tx.query<{slot:number}>("SELECT DISTINCT slot FROM demo_skyjet_bets WHERE player_id=$1 AND round_id=$2 AND status<>'cancelled'",[playerId,round.id]) : {rows:[]};
 return {balance:Number(wallet.rows[0].balance)/100,bets,usedRoundId:round?.id??null,usedSlots:used.rows.map(r=>r.slot),maxProfit:Number(risk.equity/BigInt(100))/100,riskBudgetCents:Number(remainingRisk(risk))};
}
export async function skySnapshot(tx:PoolClient,playerId:string,now:number,round?:SharedRound){await createDemoWallet(tx,playerId,'skyjet',randomUUID());await settleDue(tx,now);return snapshot(tx,playerId,now,round);}
export async function skyAction(tx:PoolClient,playerId:string,actionId:string,action:Action,round:SharedRound,now:number,next?:SharedRound){
 const prior=await tx.query<{request:Action;response:unknown}>('SELECT request,response FROM demo_skyjet_actions WHERE player_id=$1 AND action_id=$2',[playerId,actionId]);
 if(prior.rows[0]){const a=prior.rows[0].request;if(a.kind!==action.kind||a.slot!==action.slot||(a.kind==='place'&&action.kind==='place'&&(a.amount!==action.amount||a.autoTarget!==action.autoTarget)))throw new TreasuryError('IDEMPOTENCY_CONFLICT');return prior.rows[0].response;}
 await createDemoWallet(tx,playerId,'skyjet',randomUUID());await settleDue(tx,now);
 if(!Number.isInteger(action.slot)||action.slot<0||action.slot>1)throw new TreasuryError('INVALID_SLOT');
 const bet=(await openBets(tx,playerId)).find(b=>b.slot===action.slot);
 if(action.kind==='place'){
  if(bet)throw new TreasuryError('GAME_IN_PROGRESS');
  if(now<round.start||now>=round.end)throw new TreasuryError('INVALID_ROUND');
  const targetRound=now<round.flightStart ? round : next;
  if(!targetRound || targetRound.id!==round.id+1 && targetRound.id!==round.id)throw new TreasuryError('INVALID_ROUND');
  if(now>=round.flightStart && now<round.crashAt){
   const used=await tx.query("SELECT 1 FROM demo_skyjet_bets WHERE player_id=$1 AND slot=$2 AND round_id=$3 AND status<>'cancelled' LIMIT 1",[playerId,action.slot,round.id]);
   if(used.rowCount)throw new TreasuryError('GAME_IN_PROGRESS');
  }
  if(!Number.isSafeInteger(action.amount)||action.amount<20000||action.amount>1000000 || (action.autoTarget!==null&&(!Number.isFinite(action.autoTarget)||action.autoTarget<1.01||action.autoTarget>10000)))throw new TreasuryError('INVALID_BET');
  const equity=(await tx.query<{equity:string}>('SELECT equity FROM demo_treasury WHERE id=1')).rows[0];
  // Reserve the maximum net payout up front. Automatic cashout at the cap is
  // necessary because the crash multiplier grows independently of the client.
  const stake=BigInt(action.amount), profitCap=skyjetProfitLimit(stake,BigInt(equity.equity)/BigInt(100),action.autoTarget),betId=randomUUID();
  if(profitCap<=BigInt(0))throw new TreasuryError('RISK_CAPACITY');
  await openWager(tx,{playerId,game:'skyjet',betId,operationId:actionId,stake,fundedStake:stake,risk:profitCap});
  await tx.query("INSERT INTO demo_skyjet_bets(bet_id,player_id,slot,round_id,flight_start,crash_at,crash,cap_payout,auto_target,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'open')",[betId,playerId,action.slot,targetRound.id,targetRound.flightStart,targetRound.crashAt,targetRound.crash,(stake+profitCap).toString(),action.autoTarget]);
 }else{
  if(!bet)throw new TreasuryError('NO_ACTIVE_GAME');
  if(action.kind==='cancel'){
   if(now>=bet.flight_start)throw new TreasuryError('INVALID_ROUND');
   await finishWager(tx,{playerId,betId:bet.bet_id,operationId:actionId,payout:BigInt(bet.stake),cancel:true});
   await tx.query("UPDATE demo_skyjet_bets SET status='cancelled' WHERE bet_id=$1",[bet.bet_id]);
  }else if(action.kind==='cash'){
   if(now<bet.flight_start||now>=bet.crash_at)throw new TreasuryError('INVALID_ROUND');
   const payout=Math.min(Number(bet.cap_payout),Math.floor(Number(bet.stake)*Math.exp(.00006*(now-bet.flight_start))));
   await finishWager(tx,{playerId,betId:bet.bet_id,operationId:actionId,payout:BigInt(payout)});
   await tx.query("UPDATE demo_skyjet_bets SET status='settled' WHERE bet_id=$1",[bet.bet_id]);
  }else throw new TreasuryError('INVALID_ACTION');
 }
 const response=await snapshot(tx,playerId,now,round);
 await tx.query('INSERT INTO demo_skyjet_actions(player_id,action_id,request,response) VALUES($1,$2,$3::jsonb,$4::jsonb)',[playerId,actionId,JSON.stringify(action),JSON.stringify(response)]);
 return response;
}
