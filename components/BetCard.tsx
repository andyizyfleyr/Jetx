'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame, type Bet } from '@/store/game';
import { playSound } from '@/lib/audio';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BetCard({ bet, index, amount, setAmount }: { bet: Bet; index: number; amount: string; setAmount: (value: string) => void }) {
  const [error, setError] = useState('');
  const { multiplier, place, cancel, cash, sound, balance, phase, notify, invalidBets, set, syncReady } = useGame();
  const invalid = invalidBets.includes(index);
  const update = (value: string) => { setAmount(value); setError(''); if (invalid) set({ invalidBets: useGame.getState().invalidBets.filter(i => i !== index) }); };
  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value < 1) { setError('Minimum : $ 1.00'); return; }
    if (value > balance) { setError('Solde insuffisant'); return; }
    place(index, value); setError('');
    if (useGame.getState().bets[index].status === 'queued') notify(`Mise de $ ${money(useGame.getState().bets[index].amount)} placée ${useGame.getState().phase === 'WAITING' ? 'pour cette manche' : 'pour la prochaine manche'}.`);
  };
  return <motion.div initial={false} animate={{ opacity: 1 }} className={`bet-card ${bet.status} ${invalid && bet.status === 'empty' ? 'invalid-bet' : ''}`}>
    {bet.status === 'empty' ? <>
      <span className="sr-only" aria-live="polite">{bet.result ? (bet.result.type === 'won' ? `Gain encaissé : $ ${money(bet.result.amount)}` : 'Mise perdue') : ''}</span>
      <div className="amount-control">
        <button aria-label={`Diminuer la mise ${index + 1}`} onClick={() => update(String(Math.max(1, (Number(amount) || 1) - 10)))}><Minus size={16} /></button>
        <label><span className="sr-only">Montant de la mise {index + 1}</span><span>$</span><input aria-invalid={invalid || !!error} inputMode="decimal" value={amount} maxLength={10} onChange={e => update(e.target.value.replace(/[^0-9.,]/g, ''))} /></label>
        <button aria-label={`Augmenter la mise ${index + 1}`} onClick={() => update(String((Number(amount) || 0) + 10))}><Plus size={16} /></button>
      </div>
      <div className="quick-bets">{[10, 50, 100, 500].map(n => <button key={n} className={Number(amount) === n ? 'chosen' : ''} onClick={() => update(String(n))}>{n}</button>)}</div>
      {error && <div className="card-error" role="status">{error}</div>}
      <button className="bet-button bet-green" disabled={!syncReady} onClick={submit}>Miser</button>
    </> : <>
      <div className="bet-caption">{bet.status === 'active' ? 'Vous gagnez' : phase === 'WAITING' ? 'Mise placée · cette manche' : 'En attente de la prochaine manche'}</div>
      <div className="bet-value">$ {money(bet.status === 'active' ? Math.floor(bet.amount * multiplier * 100) / 100 : bet.amount)}</div>
      <button className={`bet-button ${bet.status === 'active' ? 'bet-green' : 'bet-red'}`} disabled={!syncReady} onClick={() => { if (bet.status === 'active') { const gain = cash(index); if (gain) { playSound('cash', sound); notify(`Mise encaissée : $ ${money(gain)} à ${useGame.getState().multiplier.toFixed(2)}x.`, 'success'); } } else { if (cancel(index)) notify(`Mise annulée : $ ${money(bet.amount)} remboursés.`, 'success'); } }}>{bet.status === 'active' ? 'Encaisser' : 'Annuler'}</button>
    </>}
  </motion.div>;
}
