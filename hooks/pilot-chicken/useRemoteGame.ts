'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty } from '@/lib/pilot-chicken/format';
import type { Result } from './useGame';
type Phase='idle'|'playing'|'won'|'lost';
type Round={id:string;phase:'betting'|'decision';step:number;deadline:number;serverTime:number;commitment:string;chosen:boolean;joined:boolean};
type Player={name:string;stake:number;status:string;step:number};
type Proof={id:string;seed:string;commitment:string;outcome:string;step:number};
type Remote={balance:number;difficulty:Difficulty;free:boolean;freeAvailable:boolean;phase:Phase;step:number;stake:number;multiplier:number;history:Result[];round?:Round;players?:Player[];playerCount?:number;previous?:Proof|null;legacy?:boolean};
type State=Remote & {amount:number;mode:'bet'|'free';message:string;event:number;busy:boolean;ready:boolean};
const initial:State={balance:0,amount:500,difficulty:'Easy',mode:'bet',free:false,freeAvailable:false,phase:'idle',step:0,stake:0,multiplier:1,history:[],message:'Connexion…',event:0,busy:false,ready:false};
export function useRemoteGame(enabled:boolean){
 const [game,setGame]=useState<State>(initial);const state=useRef(game),busy=useRef(false),epoch=useRef(0),polling=useRef(false);
 const update=useCallback((change:(g:State)=>State)=>{state.current=change(state.current);setGame(state.current);},[]);
 const snapshot=useCallback(async(force=false)=>{
  if(polling.current&&!force)return;polling.current=true;const version=epoch.current;
  try{const r=await fetch('/api/pilot-chicken',{cache:'no-store'});if(r.status===401){window.location.href=window.location.origin+'/compte';throw Error('Compte requis.');}if(!r.ok)throw Error('Connexion au jeu indisponible.');const data:Remote=await r.json();
   if((!busy.current||force)&&version===epoch.current)update(g=>({...g,...data,legacy:!!data.legacy,round:data.round,players:data.players??[],previous:data.previous??null,mode:data.phase==='playing'?(data.free?'free':'bet'):g.mode,ready:true,message:'',event:g.event+1}));
  }finally{polling.current=false;}
 },[update]);
 useEffect(()=>{if(!enabled)return;let live=true;const poll=()=>{if(document.visibilityState==='visible')void snapshot().catch(()=>{if(live)update(g=>({...g,ready:false,message:'Connexion au jeu indisponible. Reconnexion…'}));});};poll();const timer=window.setInterval(poll,1000);const visibility=()=>{if(document.visibilityState==='visible')poll();};document.addEventListener('visibilitychange',visibility);return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};},[enabled,snapshot,update]);
 const act=useCallback(async(kind:'start'|'next'|'cash')=>{
  if(busy.current||!state.current.ready)return;const g=state.current;busy.current=true;epoch.current++;update(v=>({...v,busy:true,message:''}));
  const body=kind==='start'?{kind,id:crypto.randomUUID(),amount:g.amount,free:g.mode==='free',roundId:g.round?.id??''}:{kind,id:crypto.randomUUID(),roundId:g.round?.id??'',step:g.round?.step??g.step};
  try{
   let response:Response|undefined;for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/pilot-chicken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});break;}catch{if(attempt)throw Error('Connexion interrompue.');}}
   if(!response)throw Error('Connexion interrompue.');if(response.status===401){window.location.href=window.location.origin+'/compte';throw Error('Compte requis.');}
   const data=await response.json();if(!response.ok){const code=String(data.error||'');throw Error(code==='INSUFFICIENT_BALANCE'?'Solde insuffisant.':code==='CHOICE_LOCKED'?'Choix déjà confirmé pour cette traversée.':code==='BETTING_CLOSED'?'Mises fermées : attendez la prochaine manche.':code==='ROUND_CHANGED'||code==='STEP_CHANGED'?'La manche a changé. Réessayez.':'Action indisponible.');}
   update(v=>({...v,...data,legacy:!!data.legacy,round:data.round,players:data.players??[],previous:data.previous??null,mode:data.phase==='playing'?(data.free?'free':'bet'):v.mode,message:'',ready:true,event:v.event+1}));
  }catch(e){try{await snapshot(true);}catch{update(v=>({...v,ready:false}));}update(v=>({...v,message:e instanceof Error?e.message:'Connexion interrompue.'}));}
  finally{busy.current=false;update(v=>({...v,busy:false}));}
 },[snapshot,update]);
 const setAmount=useCallback((v:number)=>update(g=>g.phase==='playing'?g:{...g,amount:Math.max(100,Math.min(100000,Math.round(Number.isFinite(v)?v:100)))}),[update]);
 const setMode=useCallback((v:'bet'|'free')=>update(g=>g.phase==='playing'?g:{...g,mode:v}),[update]);
 return {game,setAmount,setMode,start:()=>void act('start'),next:()=>void act('next'),cash:()=>void act('cash')};
}
