'use client';
import { useGame } from '@/store/game';
import { playSound } from '@/lib/audio';
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kept outside the scrolling area so round actions are always within reach. */
export default function BulkActions({ amounts }: { amounts: string[] }) {
  const { bets, phase, multiplier, placeAll, cancelAll, cashAll, sound, notify, set, syncReady } = useGame();
  const active = bets.filter(b => b.status === 'active'), queued = bets.filter(b => b.status === 'queued'), free = bets.filter(b => b.status === 'empty');
  const values = amounts.map(value => Number(value.replace(',', '.')));
  const totalPlace = bets.reduce((sum, bet, i) => sum + (bet.status === 'empty' && Number.isFinite(values[i]) && values[i] >= 1 ? Math.round(values[i] * 100) / 100 : 0), 0);
  const totalQueued = queued.reduce((sum, bet) => sum + bet.amount, 0);
  const totalActive = active.reduce((sum, bet) => sum + Math.floor(bet.amount * multiplier * 100) / 100, 0);
  const placeEverything = () => {
    const invalid = bets.map((bet, i) => bet.status === 'empty' && (!Number.isFinite(values[i]) || Math.round(values[i] * 100) < 100) ? i : -1).filter(i => i >= 0);
    set({ invalidBets: invalid });
    const result = placeAll(values);
    const text = result === 'offline' ? 'Synchronisation indisponible : réessayez.' : result === 'insufficient' ? 'Solde insuffisant pour toutes les mises libres.' : result === 'invalid' ? 'Vérifiez les montants surlignés : minimum $ 1.00.' : result === 'none' ? 'Aucune mise libre.' : useGame.getState().phase === 'WAITING' ? 'Mises placées pour cette manche.' : 'Mises placées pour la prochaine manche.';
    notify(text, result === 'ok' ? 'success' : 'error');
  };
  return <div className="bulk-fixed">
    <div className="bulk-actions classic-actions" aria-label="Actions groupées">
      {phase === 'FLYING' && active.length > 0 && <button className="all-button all-green" disabled={!syncReady} onClick={() => { const gain = cashAll(); if (gain) { playSound('cash', sound); notify(`Gains encaissés : $ ${money(gain)} à ${useGame.getState().multiplier.toFixed(2)}x.`, 'success'); } }}><strong>Tout encaisser</strong><span>$ {money(totalActive)}</span></button>}
      {queued.length > 0 && <button className="all-button all-red" disabled={!syncReady} onClick={() => { const cancelled = cancelAll(); if (cancelled) notify(`Mises annulées : $ ${money(cancelled)} remboursés.`, 'success'); }}><strong>Tout annuler</strong><span>$ {money(totalQueued)}</span></button>}
      {free.length > 0 && <button className="all-button all-place" disabled={!syncReady} onClick={placeEverything}><strong>Placer toutes les mises</strong><span>$ {money(totalPlace)}{phase !== 'WAITING' ? ' · prochaine manche' : ''}</span></button>}
    </div>
  </div>;
}
