'use client';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '@/store/game';
import { skyBatch } from '@/lib/centralSky';
import { displayBetStatus } from '@/lib/skyjetBetDisplay';
import { canCoverBets } from '@/lib/skyjetAvailability';
import { isValidBetAmount } from '@/lib/betLimits';
const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kept outside the scrolling area so round actions are always within reach. */
export default function BulkActions({ amounts }: { amounts: string[] }) {
  const {bets,phase,multiplier,notify,set,syncReady,actionPending,roundId,balance,riskBudgetCents,maxProfit,autoCash,autoTarget}=useGame(useShallow(s=>({bets:s.bets,phase:s.phase,multiplier:s.multiplier,notify:s.notify,set:s.set,syncReady:s.syncReady,actionPending:s.actionPending,roundId:s.roundId,balance:s.balance,riskBudgetCents:s.riskBudgetCents,maxProfit:s.maxProfit,autoCash:s.autoCash,autoTarget:s.autoTarget})));
  const statuses=bets.map(b=>displayBetStatus(b,phase,roundId));
  const active=bets.filter((_,i)=>statuses[i]==='active'), queued=bets.filter((_,i)=>statuses[i]==='queued'), free=bets.filter((_,i)=>statuses[i]==='empty');
  const values = amounts.map(value => Number(value.replace(',', '.')));
  const totalPlace = bets.reduce((sum, bet, i) => sum + (bet.status === 'empty' && isValidBetAmount(values[i]) ? Math.round(values[i] * 100) / 100 : 0), 0);
  const placeAmounts=values.filter((_,i)=>statuses[i]==='empty');
  const bulkCovered=canCoverBets(placeAmounts,balance,riskBudgetCents,maxProfit,autoCash,autoTarget);
  const totalQueued = queued.reduce((sum, bet) => sum + bet.amount, 0);
  const totalActive = active.reduce((sum, bet) => sum + Math.min(bet.capPayout ?? Infinity, Math.floor(bet.amount * multiplier * 100) / 100), 0);
  const placeEverything = () => {
    const invalid = bets.map((bet, i) => bet.status === 'empty' && !isValidBetAmount(values[i]) ? i : -1).filter(i => i >= 0);
    set({ invalidBets: invalid });
    if(invalid.length){notify('Vérifiez les montants surlignés.', 'error');return;}
    const actions=bets.flatMap((bet,i)=>bet.status==='empty'?[{kind:'place' as const,slot:i,amount:values[i]}]:[]);
    if(actions.length)void skyBatch(actions);
  };
  return <div className="bulk-fixed">
    <div className="bulk-actions classic-actions" aria-label="Actions groupées">
      {phase === 'FLYING' && active.length > 0 ? <button className="all-button all-green" disabled={!syncReady || actionPending} onClick={() => { void skyBatch(bets.flatMap((_,i)=>statuses[i]==='active'?[{kind:'cash' as const,slot:i}]:[])); }}><strong>{actionPending?'Patientez…':'Tout encaisser'}</strong><span>{money(totalActive)} ₣</span></button>
        : queued.length > 0 ? <button className="all-button all-red" disabled={!syncReady || actionPending} onClick={() => { void skyBatch(bets.flatMap((_,i)=>statuses[i]==='queued'?[{kind:'cancel' as const,slot:i}]:[])); }}><strong>{actionPending?'Patientez…':'Tout annuler'}</strong><span>{money(totalQueued)} ₣</span></button>
        : <button className="all-button all-place" disabled={!syncReady || actionPending || phase!=='WAITING' || free.length === 0 || !bulkCovered} onClick={placeEverything}><strong>{actionPending?'Patientez…':phase!=='WAITING'?'Mises fermées':!bulkCovered?'Mises groupées indisponibles':'Placer toutes les mises'}</strong><span>{money(totalPlace)} ₣</span></button>}
    </div>
  </div>;
}
