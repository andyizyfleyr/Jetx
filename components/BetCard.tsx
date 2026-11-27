'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame, type Bet } from '@/store/game';
import { playSound } from '@/lib/audio';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BetCard({ bet, index, amount, setAmount }: { bet: Bet; index: number; amount: string; setAmount: (value: string) => void }) {
  const [error, setError] = useState('');
  const { multiplier, place, cancel, cash, sound, balance } = useGame();
  const update = (value: string) => { setAmount(value); setError(''); };
  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value < 1) { setError('Minimum : $ 1.00'); return; }
    if (value > balance) { setError('Solde insuffisant'); return; }
    place(index, value); setError('');
  };
  return <motion.div initial={false} animate={{ opacity: 1 }} className={`bet-card ${bet.status}`}>
    {bet.status === 'empty' ? <>
      <div className="card-topline"><span>MISE {index + 1}</span><span className={`result-note ${bet.result?.type || ''}`} aria-live="polite">{bet.result ? (bet.result.type === 'won' ? `+ $ ${money(bet.result.amount)}` : 'Mise perdue') : 'MONTANT'}</span></div>
      <div className="amount-control">
        <button aria-label={`Diminuer la mise ${index + 1}`} onClick={() => update(String(Math.max(1, (Number(amount) || 1) - 10)))}><Minus size={16} /></button>
        <label><span className="sr-only">Montant de la mise {index + 1}</span><span>$</span><input inputMode="decimal" value={amount} maxLength={10} onChange={e => update(e.target.value.replace(/[^0-9.,]/g, ''))} /></label>
        <button aria-label={`Augmenter la mise ${index + 1}`} onClick={() => update(String((Number(amount) || 0) + 10))}><Plus size={16} /></button>
      </div>
      <div className="quick-bets">{[10, 50, 100, 500].map(n => <button key={n} className={Number(amount) === n ? 'chosen' : ''} onClick={() => update(String(n))}>{n}</button>)}</div>
      <div className="card-error" role="status">{error || '\u00a0'}</div>
      <button className="bet-button bet-green" onClick={submit}>Miser <span>↗</span></button>
    </> : <>
      <div className="card-topline"><span>MISE {index + 1}</span><span className={`status-dot ${bet.status}`} /> </div>
      <div className="bet-caption">{bet.status === 'active' ? 'Gain actuel' : 'Manche suivante'}</div>
      <div className="bet-value">$ {money(bet.status === 'active' ? Math.floor(bet.amount * multiplier * 100) / 100 : bet.amount)}</div>
      <button className={`bet-button ${bet.status === 'active' ? 'bet-green' : 'bet-red'}`} onClick={() => { if (bet.status === 'active') { if (cash(index)) playSound('cash', sound); } else cancel(index); }}>{bet.status === 'active' ? 'Encaisser' : 'Annuler'}</button>
    </>}
  </motion.div>;
}
