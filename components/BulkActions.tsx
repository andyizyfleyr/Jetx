'use client';
import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { playSound } from '@/lib/audio';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kept outside the scrolling area so round actions are always within reach. */
export default function BulkActions({ amounts }: { amounts: string[] }) {
  const { bets, phase, multiplier, placeAll, cancelAll, cashAll, sound } = useGame();
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 4000); return () => window.clearTimeout(timer); }, [message]);
  const active = bets.filter(b => b.status === 'active'), queued = bets.filter(b => b.status === 'queued'), free = bets.filter(b => b.status === 'empty');
  const values = amounts.map(value => Number(value.replace(',', '.')));
  const totalPlace = bets.reduce((sum, bet, i) => sum + (bet.status === 'empty' && Number.isFinite(values[i]) && values[i] >= 1 ? Math.round(values[i] * 100) / 100 : 0), 0);
  const totalQueued = queued.reduce((sum, bet) => sum + bet.amount, 0);
  const totalActive = active.reduce((sum, bet) => sum + Math.floor(bet.amount * multiplier * 100) / 100, 0);
  const placeEverything = () => {
    const result = placeAll(values);
    setMessage(result === 'insufficient' ? 'Solde insuffisant pour toutes les mises libres.' : result === 'invalid' ? 'Vérifiez les montants : minimum $ 1.00 par mise.' : result === 'none' ? 'Aucune mise libre.' : phase === 'WAITING' ? 'Mises placées pour cette manche.' : 'Mises placées pour la prochaine manche.');
  };
  return <div className="bulk-fixed">
    <div className="bulk-actions classic-actions" aria-label="Actions groupées">
      {phase === 'FLYING' && active.length > 0 && <button className="all-button all-green" onClick={() => { const gain = cashAll(); if (gain) { playSound('cash', sound); setMessage(`Gains encaissés : $ ${money(gain)}.`); } }}><strong>Tout encaisser</strong><span>$ {money(totalActive)}</span></button>}
      {queued.length > 0 && <button className="all-button all-red" onClick={() => { cancelAll(); setMessage('Mises en attente annulées et remboursées.'); }}><strong>Tout annuler</strong><span>$ {money(totalQueued)}</span></button>}
      {free.length > 0 && <button className="all-button all-place" onClick={placeEverything}><strong>Placer toutes les mises</strong><span>$ {money(totalPlace)}{phase !== 'WAITING' ? ' · prochaine manche' : ''}</span></button>}
    </div><div className="bulk-message" role="status" aria-live="polite">{message}</div>
  </div>;
}
