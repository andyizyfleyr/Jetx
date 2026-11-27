'use client';
import { useEffect, useState } from 'react';
import { Wifi, Users } from 'lucide-react';
import { useGame } from '@/store/game';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameHeader } from './Header';
import MultiplierHistory from './MultiplierHistory';
import GameCanvas from './GameCanvas';
import FlightFeedback from './FlightFeedback';
import MultiplierDisplay from './MultiplierDisplay';
import BetPanel from './BetPanel';
import BulkActions from './BulkActions';
export default function Game(){useGameEngine(); const {online,players,phase}=useGame(); const [time,setTime]=useState('--:--'); const [amounts,setAmounts]=useState(['100','100','100','100']); useEffect(()=>{const update=()=>setTime(new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));update();const id=setInterval(update,10000);return()=>clearInterval(id);},[]); const lastCash=players.filter(p=>p.cashed).slice(-1);
 return <main className="phone"><header className="topbar"><GameHeader/></header><section className={`game-area phase-${phase.toLowerCase()}`}><GameCanvas/><div className="game-shade"/><MultiplierHistory/><FlightFeedback/>{phase==='FLYING'&&<div className="cash-bubbles" aria-hidden="true">{lastCash.map((p,i)=><span key={`${p.name}-${p.target}`} style={{left:`${i*3}%`}}>$ {(p.stake*p.target).toFixed(2)}</span>)}</div>}<MultiplierDisplay/><div className="game-meta"><span><Wifi size={14}/> <span>LOCAL · {time}</span></span><span><Users size={15}/> {online} En ligne</span></div></section><div className="lower-content"><BetPanel amounts={amounts} setAmounts={setAmounts}/></div><BulkActions amounts={amounts}/></main>;
}
