'use client';
import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame, type Bet } from '@/store/game';
import { skyCommand } from '@/lib/centralSky';
import { displayBetStatus } from '@/lib/skyjetBetDisplay';
import { canCoverBets } from '@/lib/skyjetAvailability';
import { MIN_BET, MAX_BET, QUICK_BETS, isValidBetAmount } from '@/lib/betLimits';
const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BetCard({ bet, index, amount, setAmount }: { bet: Bet; index: number; amount: string; setAmount: (value: string) => void }) {
  const [error, setError] = useState('');
  const {multiplier,balance,phase,invalidBets,set,syncReady,actionPending,pendingSlots,roundId,riskBudgetCents,maxProfit,autoCash,autoTarget}=useGame(useShallow(s=>({multiplier:s.multiplier,balance:s.balance,phase:s.phase,invalidBets:s.invalidBets,set:s.set,syncReady:s.syncReady,actionPending:s.actionPending,pendingSlots:s.pendingSlots,roundId:s.roundId,riskBudgetCents:s.riskBudgetCents,maxProfit:s.maxProfit,autoCash:s.autoCash,autoTarget:s.autoTarget})));
  const status=displayBetStatus(bet,phase,roundId);
  const thisPending=actionPending && pendingSlots.includes(index);
  const invalid = invalidBets.includes(index);
  const value=Number(amount.replace(',', '.'));
  const covered=canCoverBets([value],balance,riskBudgetCents,maxProfit,autoCash,autoTarget);
  const riskBlocked=isValidBetAmount(value)&&value<=balance&&!covered;

  const update = (value: string) => { setAmount(value); setError(''); if (invalid) set({ invalidBets: useGame.getState().invalidBets.filter(i => i !== index) }); };
  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!isValidBetAmount(value)) { setError('Mise : 200 à 10 000 ₣'); return; }
    if (value > balance) { setError('Solde insuffisant'); return; }
    void skyCommand('place',index,value); setError('');
  };
  return <motion.div initial={false} animate={{ opacity: 1 }} className={`bet-card ${bet.status} ${invalid && status === 'empty' ? 'invalid-bet' : ''}`}>
    {status === 'empty' ? <>
      <span className="sr-only" aria-live="polite">{bet.result ? (bet.result.type === 'won' ? `Gain encaissé : ${money(bet.result.amount)} ₣` : 'Mise perdue') : ''}</span>
      <div className="amount-control">
        <button aria-label={`Diminuer la mise ${index + 1}`} onClick={() => update(String(Math.min(MAX_BET, Math.max(MIN_BET, (Number(amount.replace(',', '.')) || MIN_BET) - 100))))}><Minus size={16} /></button>
        <label><span className="sr-only">Montant de la mise {index + 1}</span><input aria-invalid={invalid || !!error} inputMode="decimal" value={amount} maxLength={10} onChange={e => update(e.target.value.replace(/[^0-9.,]/g, ''))} /><span className="currency-symbol" aria-label="franc CFA">₣</span></label>
        <button aria-label={`Augmenter la mise ${index + 1}`} onClick={() => update(String(Math.min(MAX_BET, Math.max(MIN_BET, (Number(amount.replace(',', '.')) || MIN_BET) + 100))))}><Plus size={16} /></button>
      </div>
      <div className="quick-bets">{QUICK_BETS.map(n => <button key={n} className={value === n ? 'chosen' : ''} disabled={syncReady && autoCash && !canCoverBets([n],balance,riskBudgetCents,maxProfit,autoCash,autoTarget)} onClick={() => update(String(n))}>{n.toLocaleString('fr-FR')} ₣</button>)}</div>
      {(error || (syncReady && isValidBetAmount(value) && value>balance) || (riskBlocked && syncReady)) && <div className="card-error" role="status">{error || (value>balance?'Solde insuffisant.':autoCash?'Capacité insuffisante : réduisez la mise ou la cible auto.':'Capacité insuffisante : activez une cible auto ou attendez.')}</div>}
      <button className="bet-button bet-green" disabled={!syncReady || actionPending || phase!=='WAITING' || !covered} onClick={submit}>{thisPending?'Patientez…':phase!=='WAITING'?'Mises fermées':'Miser'}</button>
    </> : <>
      <div className="bet-caption">{status === 'active' ? 'Vous gagnez' : status === 'queued' ? 'Mise placée · cette manche' : 'Règlement en cours'}</div>
      <div className="bet-value">{money(status === 'active' ? Math.min(bet.capPayout ?? Infinity, Math.floor(bet.amount * multiplier * 100) / 100) : bet.amount)} ₣</div>
      <button className={`bet-button ${status === 'active' ? 'bet-green' : 'bet-red'}`} disabled={!syncReady || actionPending || status==='settling'} onClick={() => { void skyCommand(status==='active'?'cash':'cancel',index); }}>{thisPending ? 'Patientez…' : status === 'settling' ? 'Règlement…' : status === 'active' ? 'Encaisser' : 'Annuler'}</button>
    </>}
  </motion.div>;
}
