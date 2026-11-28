'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame, type Bet } from '@/store/game';
import { skyCommand } from '@/lib/centralSky';
import { MIN_BET, MAX_BET, QUICK_BETS, isValidBetAmount } from '@/lib/betLimits';
const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BetCard({ bet, index, amount, setAmount }: { bet: Bet; index: number; amount: string; setAmount: (value: string) => void }) {
  const [error, setError] = useState('');
  const { multiplier, balance, phase, invalidBets, set, syncReady } = useGame();
  const invalid = invalidBets.includes(index);
  const update = (value: string) => { setAmount(value); setError(''); if (invalid) set({ invalidBets: useGame.getState().invalidBets.filter(i => i !== index) }); };
  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!isValidBetAmount(value)) { setError('Mise : 200 à 10 000 ₣'); return; }
    if (value > balance) { setError('Solde insuffisant'); return; }
    void skyCommand('place',index,value); setError('');
  };
  return <motion.div initial={false} animate={{ opacity: 1 }} className={`bet-card ${bet.status} ${invalid && bet.status === 'empty' ? 'invalid-bet' : ''}`}>
    {bet.status === 'empty' ? <>
      <span className="sr-only" aria-live="polite">{bet.result ? (bet.result.type === 'won' ? `Gain encaissé : ${money(bet.result.amount)} ₣` : 'Mise perdue') : ''}</span>
      <div className="amount-control">
        <button aria-label={`Diminuer la mise ${index + 1}`} onClick={() => update(String(Math.min(MAX_BET, Math.max(MIN_BET, (Number(amount.replace(',', '.')) || MIN_BET) - 100))))}><Minus size={16} /></button>
        <label><span className="sr-only">Montant de la mise {index + 1}</span><input aria-invalid={invalid || !!error} inputMode="decimal" value={amount} maxLength={10} onChange={e => update(e.target.value.replace(/[^0-9.,]/g, ''))} /><span className="currency-symbol" aria-label="franc CFA">₣</span></label>
        <button aria-label={`Augmenter la mise ${index + 1}`} onClick={() => update(String(Math.min(MAX_BET, Math.max(MIN_BET, (Number(amount.replace(',', '.')) || MIN_BET) + 100))))}><Plus size={16} /></button>
      </div>
      <div className="quick-bets">{QUICK_BETS.map(n => <button key={n} className={Number(amount.replace(',', '.')) === n ? 'chosen' : ''} onClick={() => update(String(n))}>{n.toLocaleString('fr-FR')} ₣</button>)}</div>
      {error && <div className="card-error" role="status">{error}</div>}
      <button className="bet-button bet-green" disabled={!syncReady} onClick={submit}>Miser</button>
    </> : <>
      <div className="bet-caption">{bet.status === 'active' ? 'Vous gagnez' : phase === 'WAITING' ? 'Mise placée · cette manche' : 'En attente de la prochaine manche'}</div>
      <div className="bet-value">{money(bet.status === 'active' ? Math.min(bet.capPayout ?? Infinity, Math.floor(bet.amount * multiplier * 100) / 100) : bet.amount)} ₣</div>
      <button className={`bet-button ${bet.status === 'active' ? 'bet-green' : 'bet-red'}`} disabled={!syncReady} onClick={() => { void skyCommand(bet.status==='active'?'cash':'cancel',index); }}>{bet.status === 'active' ? 'Encaisser' : 'Annuler'}</button>
    </>}
  </motion.div>;
}
