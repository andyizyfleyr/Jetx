'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock3, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SharedRound, GameMode, ModeEvent } from '@/lib/sharedRounds';

type Snapshot = { serverTime: number; rounds: SharedRound[]; receivedAt: number; controlsAvailable: boolean; scheduled: ModeEvent | null };

export default function PredictionsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

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
        const data: { serverTime: number; rounds: SharedRound[]; controlsAvailable: boolean; scheduled: ModeEvent | null } = await response.json();
        if (!Number.isFinite(data.serverTime) || !Array.isArray(data.rounds)) throw new Error('Invalid schedule');
        const receivedAt = performance.now();
        if (!stopped && document.visibilityState === 'visible') {
          setSnapshot({ serverTime: data.serverTime + (receivedAt - started) / 2, rounds: data.rounds, receivedAt, controlsAvailable: data.controlsAvailable, scheduled: data.scheduled });
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
  }, [revision]);

  const fresh = snapshot !== null && now - snapshot.receivedAt <= 15000;
  const serverNow = snapshot ? snapshot.serverTime + now - snapshot.receivedAt : 0;
  const current = fresh ? snapshot.rounds.find(round => round.start <= serverNow && serverNow < round.end) : undefined;
  const upcoming = current && snapshot ? snapshot.rounds.filter(round => round.id > current.id).slice(0, 4) : [];

  const nextMode = snapshot?.scheduled?.mode ?? upcoming[0]?.mode;
  const modeLabels: Record<GameMode, string> = { normal: 'Normal', gentil: 'Gentil', plus_gentil: 'Plus gentil', beaucoup_plus_gentil: 'Beaucoup plus gentil', mechant: 'Méchant', pire: 'Pire', plus_pire: 'Plus pire', beaucoup_plus_pire: 'Beaucoup plus pire' };
  async function selectMode(mode: GameMode) {
    if (busy || !fresh || !snapshot?.controlsAvailable || !nextMode) return;
    const requested = mode === nextMode ? 'normal' : mode;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: requested }) });
      if (!response.ok) throw new Error('Mode indisponible');
      const result: { effectiveId: number; mode: GameMode } = await response.json();
      setSnapshot(null);
      setNotice(`Mode ${modeLabels[result.mode]} programmé dès la manche #${result.effectiveId}.`);
      setRevision(value => value + 1);
    } catch { setNotice('Impossible de modifier le mode. Réessayez.'); }
    finally { setBusy(false); }
  }
  const phase = current ? serverNow < current.flightStart ? 'waiting' : serverNow < current.crashAt ? 'flying' : 'crashed' : null;
  const phaseLabel = phase === 'waiting' ? 'En attente du décollage' : phase === 'flying' ? 'En vol' : 'Terminée';
  const flightTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return <main className="forecast-page">
    <header className="forecast-header">
      <Link className="forecast-back" href="/" aria-label="Retour au jeu"><ArrowLeft size={20}/></Link>
      <Link href="/" className="logo">Sky<span>Jet</span><i>✦</i></Link>
      <span className="forecast-badge">DÉMO</span>
    </header>
    <section className="forecast-content">
      <section className="mode-controls" aria-label="Réglage des modes">
        <div className="mode-grid" role="group" aria-label="Choisir le mode des prochaines manches">
          {(['gentil', 'plus_gentil', 'beaucoup_plus_gentil', 'mechant', 'pire', 'plus_pire', 'beaucoup_plus_pire'] as const).map(mode => <button key={mode} type="button" className={`mode-toggle ${nextMode === mode ? 'selected' : ''}`} aria-pressed={nextMode === mode} disabled={!fresh || !snapshot?.controlsAvailable || busy || !current} onClick={() => void selectMode(mode)}><strong>{modeLabels[mode]}</strong><span>{mode.includes('gentil') ? 'Plus hauts' : 'Plus bas'}</span><i aria-hidden="true"/></button>)}
        </div>
        <div className="mode-detail">{current ? <>Actuel : <strong>{modeLabels[current.mode]}</strong> · {snapshot?.scheduled ? <>Prévu dès #{snapshot.scheduled.effectiveId} : <strong>{modeLabels[snapshot.scheduled.mode]}</strong></> : <>Suivant : <strong>{nextMode ? modeLabels[nextMode] : '—'}</strong></>}{nextMode && nextMode !== 'normal' ? ' · Appuyez à nouveau pour revenir au mode normal.' : ''}</> : 'Synchronisation des modes…'}</div>
        {!snapshot?.controlsAvailable && snapshot && <div className="mode-warning">Pilotage indisponible : la variable DATABASE_URL doit être configurée sur le serveur.</div>}
        <p className="mode-disclaimer">Les résultats peuvent changer selon le mode choisi par les visiteurs. Démo prévisible, sans argent réel.</p>
        {notice && <div className="mode-notice" role="status">{notice}</div>}
      </section>
      <div className="forecast-section-title"><div><span>REPÈRE</span><h2>Manche affichée dans le jeu</h2></div><div className={`forecast-status ${current ? 'live' : ''}`}><i/>{current ? 'Synchronisé' : 'Synchronisation'}</div></div>
      {current ? <article className="forecast-current" aria-label={`Manche affichée dans le jeu numéro ${current.id}`}>
        <div className="forecast-current-head"><span className="forecast-current-id">MANCHE #{current.id}</span><span className="forecast-current-phase">{phaseLabel} · {modeLabels[current.mode]}</span></div>
        <div className="forecast-current-body"><div><strong>{phase === 'crashed' ? 'Résultat final' : 'Résultat final programmé'}</strong><span><Clock3 size={13}/> Décollage {flightTime(current.flightStart)}</span></div><div className="forecast-value">{current.crash.toFixed(2)}<small>x</small></div></div>
        <p>{phase === 'waiting' ? 'C’est la manche du compte à rebours affiché dans le jeu.' : phase === 'flying' ? 'C’est la manche actuellement en vol dans le jeu.' : 'Cette manche vient de se terminer. La suivante arrive après la pause.'}</p>
      </article> : <div className="forecast-empty">{error ? 'Connexion indisponible. Nouvelle tentative en cours…' : 'Synchronisation de la manche…'}</div>}
      <div className="forecast-section-title forecast-upcoming-title"><div><span>APRÈS CETTE MANCHE</span><h2>Manches suivantes</h2></div></div>
      <p className="forecast-sequence">Ces manches viennent après celle affichée dans le jeu.</p>
      <div className="forecast-list" aria-live="polite">
        {upcoming.length ? upcoming.map((round, i) => <article className="forecast-card" key={round.id}>
          <div className="forecast-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="forecast-details"><strong>{i === 0 ? 'Manche suivante' : `Manche +${i + 1}`} · #{round.id}</strong><span><Clock3 size={13}/> Décollage {flightTime(round.flightStart)} · {modeLabels[round.mode]}</span></div>
          <div className="forecast-future-result"><span>RÉSULTAT FINAL</span><div className="forecast-value">{round.crash.toFixed(2)}<small>x</small></div></div>
        </article>) : <div className="forecast-empty">{error ? 'Connexion indisponible. Nouvelle tentative en cours…' : 'Chargement des prochaines manches…'}</div>}
      </div>
      <div className="forecast-footnote"><Info size={16}/><span>Horaires affichés dans votre fuseau horaire. Un léger décalage réseau est possible. Aucun argent réel.</span></div>
      <Link href="/" className="forecast-play">Retourner au jeu <ArrowUpRight size={18}/></Link>
    </section>
  </main>;
}
