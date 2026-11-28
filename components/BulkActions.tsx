'use client';
import { useGame } from '@/store/game';
import { skyBatch } from '@/lib/centralSky';
import { isValidBetAmount } from '@/lib/betLimits';
const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kept outside the scrolling area so round actions are always within reach. */
export default function BulkActions({ amounts }: { amounts: string[] }) {
  const { bets, phase, multiplier, notify, set, syncReady } = useGame();
  const active = bets.filter(b => b.status === 'active'), queued = bets.filter(b => b.status === 'queued'), free = bets.filter(b => b.status === 'empty');
  const values = amounts.map(value => Number(value.replace(',', '.')));
  const totalPlace = bets.reduce((sum, bet, i) => sum + (bet.status === 'empty' && isValidBetAmount(values[i]) ? Math.round(values[i] * 100) / 100 : 0), 0);
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
      {phase === 'FLYING' && active.length > 0 ? <button className="all-button all-green" disabled={!syncReady} onClick={() => { void skyBatch(bets.flatMap((b,i)=>b.status==='active'?[{kind:'cash' as const,slot:i}]:[])); }}><strong>Tout encaisser</strong><span>{money(totalActive)} ₣</span></button>
        : queued.length > 0 ? <button className="all-button all-red" disabled={!syncReady} onClick={() => { void skyBatch(bets.flatMap((b,i)=>b.status==='queued'?[{kind:'cancel' as const,slot:i}]:[])); }}><strong>Tout annuler</strong><span>{money(totalQueued)} ₣</span></button>
        : <button className="all-button all-place" disabled={!syncReady || free.length === 0} onClick={placeEverything}><strong>Placer toutes les mises</strong><span>{money(totalPlace)} ₣{phase !== 'WAITING' ? ' · prochaine manche' : ''}</span></button>}
    </div>
  </div>;
}
