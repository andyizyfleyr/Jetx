'use client';
import { useGame, type Bet } from '@/store/game';
export const centralSkyEnabled=true;
let busy=false, epoch=0;
type ServerBet={slot:number;amount:number;roundId:number;status:'active'|'queued';capPayout:number};
export function applySkySnapshot(data:{balance:number;maxProfit:number;bets:ServerBet[]}) {
 if(!Number.isFinite(data.balance)||!Number.isFinite(data.maxProfit)||!Array.isArray(data.bets))throw Error('Réponse invalide');
 useGame.setState(s=>({balance:data.balance,maxProfit:data.maxProfit,bets:s.bets.map((old,i)=>{const b=data.bets.find(x=>x.slot===i);return b?{...old,amount:b.amount,lastAmount:b.amount,roundId:b.roundId,status:b.status,capPayout:b.capPayout}:({...old,status:'empty',roundId:undefined,capPayout:undefined} as Bet);})}));
}
export async function refreshSky(force=false){const current=epoch;const response=await fetch('/api/skyjet',{cache:'no-store'});if(response.status===401){window.location.href=window.location.origin+'/compte';throw Error('Compte requis');}if(!response.ok)throw Error('Service indisponible');const data=await response.json();if((!busy||force)&&current===epoch)applySkySnapshot(data);}
export async function skyCommand(kind:'place'|'cancel'|'cash',slot:number,amount?:number){
 return skyBatch([{kind,slot,amount}]);
}
export async function skyBatch(operations:{kind:'place'|'cancel'|'cash';slot:number;amount?:number}[]){
 if(busy)return false;busy=true;useGame.setState({actionPending:true,pendingSlots:operations.map(o=>o.slot)});epoch++;
 const state=useGame.getState();const actions=operations.map(({kind,slot,amount})=>({kind,slot,...(kind==='place'?{amount:Math.round((amount||0)*100),autoTarget:state.autoCash?state.autoTarget:null}:{})}));const body=actions.length===1?{id:crypto.randomUUID(),...actions[0]}:{id:crypto.randomUUID(),kind:'batch',actions};
 try {let response:Response|undefined;for(let n=0;n<2;n++){try{response=await fetch('/api/skyjet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});break;}catch{if(n)throw Error('Connexion interrompue');}}
  if(!response)throw Error('Connexion interrompue');if(response.status===401){window.location.href=window.location.origin+'/compte';throw Error('Compte requis');}const data=await response.json();if(!response.ok){const code=String(data.error||'');throw Error(code==='INVALID_ROUND'?'Mise disponible pendant l’attente de la manche.':code==='RISK_HOURLY_LIMIT'?'Caisse temporairement limitée : trop de gains ou engagements sur la dernière heure. Réessayez plus tard ou réduisez la cible automatique.':code==='RISK_PLAYER_LIMIT'?'Limite de risque de votre compte atteinte : attendez le règlement de vos mises.':code.startsWith('RISK_')?'La caisse ne peut pas couvrir cette mise pour le moment.':code==='INSUFFICIENT_BALANCE'?'Solde insuffisant.':'Action indisponible.');}applySkySnapshot(data);return true;
 }catch(e){useGame.getState().notify(e instanceof Error?e.message:'Connexion interrompue','error');try{await refreshSky(true);}catch{useGame.setState({syncReady:false});}return false;}finally{busy=false;useGame.setState({actionPending:false,pendingSlots:[]});}
}
