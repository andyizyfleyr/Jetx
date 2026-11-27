'use client';
import { RefreshCw } from 'lucide-react';
import { useGame } from '@/store/game';
import { playSound } from '@/lib/audio';
import BetCard from './BetCard';
const money=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function BetPanel(){const {bets,phase,multiplier,autoCash,autoTarget,autoPlay,set,cancelAll,cashAll,sound}=useGame(); const active=bets.filter(b=>b.status==='active'); const queued=bets.filter(b=>b.status==='queued'); const showCash=phase==='FLYING'&&active.length>0; const total=showCash?active.reduce((s,b)=>s+Math.floor(b.amount*multiplier*100)/100,0):queued.reduce((s,b)=>s+b.amount,0);
 return <div className="bet-panel"><div className="panel-controls"><div className="auto-control"><button className={`switch ${autoCash?'on':''}`} role="switch" aria-checked={autoCash} aria-label="Encaissement automatique" onClick={()=>set({autoCash:!autoCash})}><span/></button><span>Encaissement auto</span>{autoCash&&<label className="target"><input aria-label="Multiplicateur cible" type="number" min="1.01" step="0.1" value={autoTarget} onChange={e=>set({autoTarget:Math.max(1.01,Number(e.target.value)||1.01)})}/>x</label>}</div><button className={`auto-play ${autoPlay?'selected':''}`} onClick={()=>set({autoPlay:!autoPlay})} aria-pressed={autoPlay}>Jeu auto <RefreshCw size={18}/></button></div><div className="bet-grid">{bets.map((b,i)=><BetCard key={i} bet={b} index={i}/>)}</div><button className={`all-button ${showCash?'all-green':'all-red'}`} disabled={!showCash&&!queued.length} onClick={()=>{if(showCash){if(cashAll())playSound('cash',sound);}else cancelAll();}}><strong>{showCash?'Tout encaisser':'Tout annuler'}</strong><span>$ {money(total)}</span></button></div>;
}
