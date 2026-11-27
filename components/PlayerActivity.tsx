'use client';

import { useSyncExternalStore } from 'react';
import { useGame } from '@/store/game';

const desktopQuery = '(min-width: 1000px)';
const subscribeDesktop = (callback: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const isDesktop = () => window.matchMedia(desktopQuery).matches;
const serverDesktop = () => false;

const amount = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Simulated players are local to this browser, not other connected users. */
export default function PlayerActivity() {
  const players = useGame(state => state.players);
  const phase = useGame(state => state.phase);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, serverDesktop);
  if (!desktop) return null;
  // Most recent simulated cash-outs first; the other entries keep their order.
  const rows = players.map((player, index) => ({ player, index }))
    .sort((a, b) => Number(b.player.cashed) - Number(a.player.cashed) || (a.player.cashed ? b.player.target - a.player.target : a.index - b.index));

  return <section className="desktop-activity" aria-label="Activité des joueurs simulés">
    <div className="activity-heading"><div><h2>Activité des joueurs</h2><p>Joueurs simulés · manche en cours</p></div><span className="activity-count">{players.length} mises</span></div>
    <div className="activity-columns" aria-hidden="true"><span>Joueur</span><span>Mise</span><span>Résultat</span></div>
    <div className="activity-list">
      {rows.length ? rows.map(({ player, index }) => <div className="activity-row" key={index}>
        <div className="activity-player"><span className="activity-avatar">{player.name[0].toUpperCase()}</span><span>{player.name}</span></div>
        <span className="activity-stake">{amount(player.stake)} ₣</span>
        {player.cashed ? <div className="activity-result won"><strong>+{amount(player.stake * player.target)} ₣</strong><small>{player.target.toFixed(2)}x</small></div> : <div className="activity-result"><span>{phase === 'WAITING' ? 'En attente' : phase === 'FLYING' ? 'En vol' : 'Perdue'}</span></div>}
      </div>) : <p className="activity-empty">Les mises apparaîtront ici.</p>}
    </div>
  </section>;
}
