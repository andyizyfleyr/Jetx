'use client';
import { useCallback, useRef, useState } from 'react';
import { type Difficulty, multiplierAt, risks } from '@/lib/pilot-chicken/format';
export type Result = { id: number; multiplier: number; bet: number; payout: number; won: boolean; free: boolean };
type Game = { balance: number; amount: number; difficulty: Difficulty; mode: 'bet'|'free'; freeAvailable: boolean; phase: 'idle'|'playing'|'won'|'lost'; step: number; stake: number; multiplier: number; history: Result[]; message: string; event: number };
const initial: Game = {balance:30000,amount:500,difficulty:'Easy',mode:'bet',freeAvailable:true,phase:'idle',step:0,stake:0,multiplier:1,history:[],message:'',event:0};
export function useGame(){
 const [game,setGame]=useState<Game>(initial); const state=useRef<Game>(initial); const nextId=useRef(0);
 const apply=useCallback((update:(g:Game)=>Game)=>{const next=update(state.current);state.current=next;setGame(next);},[]);
 const setAmount=useCallback((v:number)=>apply(g=>g.phase==='playing'?g:{...g,amount:Math.max(100,Math.min(100000,Math.round(Number.isFinite(v)?v:100)))}),[apply]);
 const difficulty=useCallback((v:Difficulty)=>apply(g=>g.phase==='playing'?g:{...g,difficulty:v}),[apply]);
 const setMode=useCallback((mode:'bet'|'free')=>apply(g=>g.phase==='playing'?g:{...g,mode,message:''}),[apply]);
 const start=useCallback(()=>apply(g=>{if(g.phase==='playing')return g; if(g.mode==='free'&&!g.freeAvailable)return {...g,message:'Free Bet déjà utilisé pour cette session.'}; const stake=g.mode==='free'?500:g.amount;if(g.mode==='bet'&&stake>g.balance)return {...g,message:'Solde insuffisant.'}; return {...g,phase:'playing',balance:g.balance-(g.mode==='bet'?stake:0),freeAvailable:g.mode==='free'?false:g.freeAvailable,stake,step:0,multiplier:1,message:'En piste !',event:g.event+1};}),[apply]);
 const cash=useCallback(()=>apply(g=>{if(g.phase!=='playing')return g;const payout=Math.floor(g.stake*g.multiplier);const result:Result={id:++nextId.current,multiplier:g.multiplier,bet:g.stake,payout,won:true,free:g.mode==='free'};return {...g,phase:'won',balance:g.balance+payout,history:[result,...g.history].slice(0,20),message:'Bien joué !',event:g.event+1};}),[apply]);
 const next=useCallback(()=>apply(g=>{if(g.phase!=='playing')return g; if(Math.random()<risks[g.difficulty]){const result:Result={id:++nextId.current,multiplier:g.multiplier,bet:g.stake,payout:0,won:false,free:g.mode==='free'};return {...g,phase:'lost',history:[result,...g.history].slice(0,20),message:'Envolé ! La mise est perdue.',event:g.event+1};}const step=g.step+1,multiplier=multiplierAt(step,g.difficulty);if(step>=24){const payout=Math.floor(g.stake*multiplier);const result:Result={id:++nextId.current,multiplier,bet:g.stake,payout,won:true,free:g.mode==='free'};return {...g,phase:'won',step,multiplier,balance:g.balance+payout,history:[result,...g.history].slice(0,20),message:'Piste traversée !',event:g.event+1};}return {...g,step,multiplier,message:'',event:g.event+1};}),[apply]);
 return {game,setAmount,difficulty,setMode,start,cash,next};
}
