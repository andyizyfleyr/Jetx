'use client';
import { RefreshCw } from 'lucide-react';
import { useGame } from '@/store/game';
import BetCard from './BetCard';

export default function BetPanel({ amounts, setAmounts }: { amounts: string[]; setAmounts: React.Dispatch<React.SetStateAction<string[]>> }) {
  const { bets, autoCash, autoTarget, autoPlay, set } = useGame();
  return <div className="bet-panel">
    <div className="panel-controls">
      <div className="auto-control"><button className={`switch ${autoCash ? 'on' : ''}`} role="switch" aria-checked={autoCash} aria-label="Encaissement automatique" onClick={() => set({ autoCash: !autoCash })}><span /></button><span>Encaissement auto</span></div>
      <button className={`auto-play ${autoPlay ? 'selected' : ''}`} onClick={() => set({ autoPlay: !autoPlay })} aria-pressed={autoPlay}>Jeu auto <RefreshCw size={18} /></button>
    </div>
    {autoCash && <div className="auto-target-row"><span>Encaisser automatiquement à</span><label className="target"><input aria-label="Multiplicateur cible" type="number" min="1.01" step="0.1" value={autoTarget} onChange={e => set({ autoTarget: Math.max(1.01, Number(e.target.value) || 1.01) })} />x</label></div>}
    <div className="bet-grid">{bets.map((b, i) => <BetCard key={i} bet={b} index={i} amount={amounts[i]} setAmount={value => setAmounts(previous => previous.map((amount, j) => i === j ? value : amount))} />)}</div>
  </div>;
}
