'use client';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useGame } from '@/store/game';
import { playSound } from '@/lib/audio';
import BetCard from './BetCard';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function BetPanel() {
  const { bets, phase, multiplier, autoCash, autoTarget, autoPlay, set, placeAll, cancelAll, cashAll, sound } = useGame();
  const [amounts, setAmounts] = useState(['100', '100', '100', '100']);
  const [message, setMessage] = useState('');
  const active = bets.filter(b => b.status === 'active'), queued = bets.filter(b => b.status === 'queued');
  const free = bets.filter(b => b.status === 'empty');
  const values = amounts.map(value => Number(value.replace(',', '.')));
  const totalPlace = bets.reduce((sum, bet, i) => sum + (bet.status === 'empty' && Number.isFinite(values[i]) && values[i] >= 1 ? Math.round(values[i] * 100) / 100 : 0), 0);
  const totalQueued = queued.reduce((sum, bet) => sum + bet.amount, 0);
  const totalActive = active.reduce((sum, bet) => sum + Math.floor(bet.amount * multiplier * 100) / 100, 0);
  const placeEverything = () => {
    const result = placeAll(values);
    setMessage(result === 'insufficient' ? 'Solde insuffisant pour placer toutes les mises libres.' : result === 'invalid' ? 'Vérifiez les montants : minimum $ 1.00 par mise.' : result === 'none' ? 'Aucune mise libre.' : phase === 'WAITING' ? 'Mises placées pour cette manche.' : 'Mises placées pour la prochaine manche.');
  };
  return <div className="bet-panel">
    <div className="panel-title"><div><span className="section-kicker">PRÊT AU DÉCOLLAGE</span><h2>Vos mises</h2></div><span className="panel-demo">ARGENT FICTIF</span></div>
    <div className="panel-controls">
      <div className="auto-control"><button className={`switch ${autoCash ? 'on' : ''}`} role="switch" aria-checked={autoCash} aria-label="Encaissement automatique" onClick={() => set({ autoCash: !autoCash })}><span /></button><span>Encaissement auto</span></div>
      <button className={`auto-play ${autoPlay ? 'selected' : ''}`} onClick={() => set({ autoPlay: !autoPlay })} aria-pressed={autoPlay}><RefreshCw size={16} /> Jeu auto</button>
    </div>
    {autoCash && <div className="auto-target-row"><span>Encaisser automatiquement à</span><label className="target"><input aria-label="Multiplicateur cible" type="number" min="1.01" step="0.1" value={autoTarget} onChange={e => set({ autoTarget: Math.max(1.01, Number(e.target.value) || 1.01) })} />x</label></div>}
    <div className="bet-grid">{bets.map((b, i) => <BetCard key={i} bet={b} index={i} amount={amounts[i]} setAmount={value => { setAmounts(previous => previous.map((amount, j) => i === j ? value : amount)); setMessage(''); }} />)}</div>
    <div className="bulk-actions classic-actions" aria-label="Actions groupées">
      {phase === 'FLYING' && active.length > 0 && <button className="all-button all-green" onClick={() => { const gain = cashAll(); if (gain) { playSound('cash', sound); setMessage(`Gains encaissés : $ ${money(gain)}.`); } }}><strong>Tout encaisser</strong><span>$ {money(totalActive)}</span></button>}
      {queued.length > 0 && <button className="all-button all-red" onClick={() => { cancelAll(); setMessage('Mises en attente annulées et remboursées.'); }}><strong>Tout annuler</strong><span>$ {money(totalQueued)}</span></button>}
      {free.length > 0 && <button className="all-button all-place" onClick={placeEverything}><strong>Placer toutes les mises</strong><span>$ {money(totalPlace)}{phase !== 'WAITING' ? ' · prochaine manche' : ''}</span></button>}
    </div><div className="bulk-message" role="status" aria-live="polite">{message}</div>
  </div>;
}
