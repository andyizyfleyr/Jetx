'use client';
import { useEffect, useState } from 'react';
import { Wifi, Users } from 'lucide-react';
import { useGame } from '@/store/game';
import { useGameEngine } from '@/hooks/useGameEngine';
import { Header, GameHeader } from './Header';
import MultiplierHistory from './MultiplierHistory';
import GameCanvas from './GameCanvas';
import MultiplierDisplay from './MultiplierDisplay';
import BetPanel from './BetPanel';
import TabsList from './TabsList';
export default function Game(){useGameEngine(); const {online,players,phase}=useGame(); const [time,setTime]=useState('--:--'); useEffect(()=>{const update=()=>setTime(new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));update();const id=setInterval(update,10000);return()=>clearInterval(id);},[]); const lastCash=players.filter(p=>p.cashed).slice(-3);
 return <main className="phone"><Header/><section className="game-area"><GameCanvas/><div className="game-shade"/><GameHeader/><MultiplierHistory/>{phase==='FLYING'&&<div className="cash-bubbles" aria-hidden="true">{lastCash.map((p,i)=><span key={`${p.name}-${p.target}`} style={{left:`${10+i*28}%`}}>$ {(p.stake*p.target).toFixed(2)}</span>)}</div>}<MultiplierDisplay/><div className="game-meta"><span><Wifi size={14}/> <span>LOCAL · {time}</span></span><span><Users size={15}/> {online} En ligne</span></div></section><BetPanel/><TabsList/><div className="home-bar"><span/></div></main>;
}
