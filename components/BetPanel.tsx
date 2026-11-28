'use client';
import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGame } from '@/store/game';
import BetCard from './BetCard';
import { centralSkyEnabled } from '@/lib/centralSky';

export default function BetPanel({ amounts, setAmounts }: { amounts: string[]; setAmounts: React.Dispatch<React.SetStateAction<string[]>> }) {
  const {bets,autoCash,autoTarget,autoPlay,set,notify}=useGame(useShallow(s=>({bets:s.bets,autoCash:s.autoCash,autoTarget:s.autoTarget,autoPlay:s.autoPlay,set:s.set,notify:s.notify})));
  const [draft, setDraft] = useState(() => String(autoTarget));
  const [editing, setEditing] = useState(false);
  const applyTarget = () => {
    const value = Number(draft.replace(',', '.'));
    if (!draft.trim() || !Number.isFinite(value) || value < 1.01 || value > 10000) {
      setDraft(String(autoTarget));
      notify(`Cible invalide : entre 1.01x et 10000x. Cible conservée : ${autoTarget.toFixed(2)}x.`, 'error');
    } else {
      set({ autoTarget: value });
      setDraft(String(value));
    }
    setEditing(false);
  };
  return <div className="bet-panel">
    <div className="panel-controls">
      <div className="auto-control"><button className={`switch ${autoCash ? 'on' : ''}`} role="switch" aria-checked={autoCash} aria-label="Encaissement automatique" onClick={() => { setDraft(String(autoTarget)); set({ autoCash: !autoCash }); }}><span /></button><span>Encaissement auto</span></div>
      <button className={`auto-play ${autoPlay ? 'selected' : ''}`} disabled={centralSkyEnabled} title={centralSkyEnabled?'Indisponible pendant la migration serveur':undefined} onClick={() => set({ autoPlay: !autoPlay })} aria-pressed={autoPlay}>Jeu auto <RefreshCw size={18} /></button>
    </div>
    {autoCash && <div className="auto-target-row"><div className="target-description"><span>Encaisser automatiquement à</span>{editing && <small>Cible active : {autoTarget.toFixed(2)}x jusqu’à validation</small>}</div><label className="target"><input aria-label="Multiplicateur cible, minimum 1,01" type="text" inputMode="decimal" autoComplete="off" value={draft} onFocus={e => { setEditing(true); e.currentTarget.select(); }} onChange={e => { if (/^\d*(?:[.,]\d*)?$/.test(e.target.value)) setDraft(e.target.value); }} onBlur={applyTarget} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />x</label></div>}
    <div className="bet-grid">{bets.map((b, i) => <BetCard key={i} bet={b} index={i} amount={amounts[i]} setAmount={value => setAmounts(previous => previous.map((amount, j) => i === j ? value : amount))} />)}</div>
  </div>;
}
