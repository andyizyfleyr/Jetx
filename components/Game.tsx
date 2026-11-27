'use client';
import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { restoreAndPersistGame } from '@/lib/gamePersistence';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { GameHeader } from './Header';
import MultiplierHistory from './MultiplierHistory';
import GameCanvas from './GameCanvas';
import FlightFeedback from './FlightFeedback';
import MultiplierDisplay from './MultiplierDisplay';
import BetPanel from './BetPanel';
import BulkActions from './BulkActions';
export default function Game(){useEffect(() => restoreAndPersistGame(), []); useGameEngine(); useScreenWakeLock(); const {players,phase,syncReady,roundId}=useGame(); const [time,setTime]=useState('--:--'); const amounts=useGame(s=>s.draftAmounts); const setAmounts: React.Dispatch<React.SetStateAction<string[]>> = value => useGame.setState(s => ({draftAmounts: typeof value === 'function' ? value(s.draftAmounts) : value})); useEffect(()=>{const update=()=>setTime(new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));update();const id=setInterval(update,10000);return()=>clearInterval(id);},[]); const lastCash=players.filter(p=>p.cashed).slice(-1);
 return <main className="phone"><header className="topbar"><GameHeader/></header><section className={`game-area phase-${phase.toLowerCase()}`}><GameCanvas/><div className="game-shade"/><MultiplierHistory/><FlightFeedback/>{phase==='FLYING'&&<div className="cash-bubbles" aria-hidden="true">{lastCash.map((p,i)=><span key={`${p.name}-${p.target}`} style={{left:`${i*3}%`}}>₣ {(p.stake*p.target).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>)}</div>}<MultiplierDisplay/><div className="game-meta"><span>{time}</span>{syncReady && <span>{`Manche #${roundId}`}</span>}</div></section><div className="controls-column"><div className="lower-content"><BetPanel amounts={amounts} setAmounts={setAmounts}/></div><BulkActions amounts={amounts}/></div></main>;
}
