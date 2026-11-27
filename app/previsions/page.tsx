'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock3, Info, Radar, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SharedRound } from '@/lib/sharedRounds';

type Snapshot = { serverTime: number; rounds: SharedRound[]; receivedAt: number };

export default function PredictionsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending || document.visibilityState !== 'visible') return;
      pending = true;
      const started = performance.now();
      try {
        const response = await fetch('/api/round', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Sync failed');
        const data: { serverTime: number; rounds: SharedRound[] } = await response.json();
        if (!Number.isFinite(data.serverTime) || !Array.isArray(data.rounds)) throw new Error('Invalid schedule');
        const receivedAt = performance.now();
        if (!stopped && document.visibilityState === 'visible') {
          setSnapshot({ serverTime: data.serverTime + (receivedAt - started) / 2, rounds: data.rounds, receivedAt });
          setNow(receivedAt);
          setError(false);
        }
      } catch { if (!stopped) setError(true); }
      finally { pending = false; }
    }
    const tick = window.setInterval(() => setNow(performance.now()), 250);
    const interval = window.setInterval(refresh, 3000);
    const visibility = () => {
      if (document.visibilityState === 'visible') { setSnapshot(null); void refresh(); }
    };
    document.addEventListener('visibilitychange', visibility);
    void refresh();
    return () => { stopped = true; controller.abort(); clearInterval(tick); clearInterval(interval); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  const fresh = snapshot !== null && now - snapshot.receivedAt <= 15000;
  const serverNow = snapshot ? snapshot.serverTime + now - snapshot.receivedAt : 0;
  const current = fresh ? snapshot.rounds.find(round => round.start <= serverNow && serverNow < round.end) : undefined;
  const upcoming = current && snapshot ? snapshot.rounds.filter(round => round.id > current.id).slice(0, 4) : [];

  return <main className="forecast-page">
    <header className="forecast-header">
      <Link className="forecast-back" href="/" aria-label="Retour au jeu"><ArrowLeft size={20}/></Link>
      <Link href="/" className="logo">Sky<span>Jet</span><i>✦</i></Link>
      <span className="forecast-badge">DÉMO</span>
    </header>
    <section className="forecast-content">
      <div className="forecast-kicker"><Radar size={15}/> MANCHES COMMUNES</div>
      <h1>Les prochains<br/><em>multiplicateurs.</em></h1>
      <p className="forecast-intro">Découvrez les résultats programmés des prochaines manches de SkyJet.</p>
      <div className="forecast-banner"><div className="forecast-icon"><Sparkles size={19}/></div><div><strong>Un aperçu, pas une prédiction magique</strong><p>Cette démo utilise un calendrier public et prévisible. Les valeurs affichées sont les résultats programmés, pas une prédiction applicable aux autres jeux.</p></div></div>
      <div className="forecast-section-title"><div><span>À VENIR</span><h2>Prochaines manches</h2></div><div className={`forecast-status ${current ? 'live' : ''}`}><i/>{current ? 'Synchronisé' : 'Synchronisation'}</div></div>
      <div className="forecast-list" aria-live="polite">
        {upcoming.length ? upcoming.map((round, i) => <article className="forecast-card" key={round.id}>
          <div className="forecast-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="forecast-details"><strong>{i === 0 ? 'Prochaine manche' : `Dans ${i + 1} manches`}</strong><span><Clock3 size={13}/> Départ {new Date(round.flightStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
          <div className="forecast-value">{round.crash.toFixed(2)}<small>x</small></div>
        </article>) : <div className="forecast-empty">{error ? 'Connexion indisponible. Nouvelle tentative en cours…' : 'Chargement des prochaines manches…'}</div>}
      </div>
      <div className="forecast-footnote"><Info size={16}/><span>Horaires affichés dans votre fuseau horaire. Un léger décalage réseau est possible. Aucun argent réel.</span></div>
      <Link href="/" className="forecast-play">Retourner au jeu <ArrowUpRight size={18}/></Link>
    </section>
  </main>;
}
