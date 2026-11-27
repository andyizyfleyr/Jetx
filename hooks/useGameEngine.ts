'use client';
import { useEffect } from 'react';
import { useGame, makePlayers, type Bet, type Phase } from '@/store/game';
import { playSound, setAudioEnabled, stopEngine, unlockAudio, updateEngine } from '@/lib/audio';
import type { SharedRound } from '@/lib/sharedRounds';

const MAX_CLOCK_AGE = 20000;
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Interpolate against server UTC, never against the player's wall clock. */
export function useGameEngine() {
  useEffect(() => {
    let frame = 0, stopped = false, inflight = false, needsSync = true, serverAnchor = 0, perfAnchor = 0;
    let rounds: SharedRound[] = [];
    let snapshotRoundId: number | undefined;
    let refresh: () => Promise<void> = async () => {};
    let historyKey = -Infinity, lastTick = -1, reportedOffline = false;
    const controller = new AbortController();

    const syncNow = (): boolean => {
      const s = useGame.getState();
      const nowPerf = performance.now();
      if (needsSync || !rounds.length || nowPerf - perfAnchor > MAX_CLOCK_AGE) {
        stopEngine();
        if (s.syncReady) s.set({ syncReady: false });
        if (rounds.length && !reportedOffline) { reportedOffline = true; s.notify('Connexion perdue : mises suspendues pendant la resynchronisation.', 'error'); }
        return false;
      }
      const now = serverAnchor + nowPerf - perfAnchor;
      const round = rounds.find(r => r.start <= now && now < r.end);
      if (!round || round.id !== snapshotRoundId) {
        stopEngine();
        if (s.syncReady) s.set({ syncReady: false });
        void refresh();
        return false;
      }
      const phase: Phase = now < round.flightStart ? 'WAITING' : now < round.crashAt ? 'FLYING' : 'CRASHED';
      const multiplier = phase === 'WAITING' ? 1 : phase === 'FLYING' ? Math.exp(.00006 * (now - round.flightStart)) : round.crash;
      const firstSync = s.roundId < 0;
      let balance = s.balance, lostCount = 0, lostTotal = 0, autoCount = 0, autoGain = 0, refunded = 0;
      let bets: Bet[] = s.bets.map(b => {
        if (b.status === 'empty' || b.roundId === undefined) return b;
        const target = rounds.find(r => r.id === b.roundId);
        if (!target) {
          // Do not invent a result when reconnection skips beyond the returned history.
          if (b.roundId < round.id) { balance += b.amount; refunded += b.amount; return { ...b, status: 'empty', roundId: undefined }; }
          return b;
        }
        if (now < target.flightStart) return b.status === 'queued' ? b : { ...b, status: 'queued' };
        const autoTime = target.flightStart + Math.log(Math.max(1.01, s.autoTarget)) / .00006;
        if (s.autoCash && autoTime < target.crashAt && now >= autoTime) {
          const gain = Math.floor(b.amount * s.autoTarget * 100) / 100;
          balance += gain; autoGain += gain; autoCount++;
          return { ...b, status: 'empty', roundId: undefined, result: { type: 'won', amount: gain } };
        }
        if (now >= target.crashAt) { lostCount++; lostTotal += b.amount; return { ...b, status: 'empty', roundId: undefined, result: { type: 'lost', amount: b.amount } }; }
        return b.status === 'active' ? b : { ...b, status: 'active' };
      });
      let replayed = 0, skipped = 0;
      // Replaying is local and only happens when the client observes the waiting phase.
      if (!firstSync && round.id !== s.roundId && phase === 'WAITING' && s.autoPlay) {
        bets = bets.map(b => {
          if (b.status !== 'empty' || b.lastAmount <= 0) return b;
          if (b.lastAmount > balance) { skipped++; return b; }
          balance -= b.lastAmount; replayed++;
          return { ...b, amount: b.lastAmount, status: 'queued', roundId: round.id, result: undefined };
        });
      }
      balance = Math.round(balance * 100) / 100;
      const roundChanged = firstSync || round.id !== s.roundId;
      const phaseChanged = phase !== s.phase || roundChanged;
      const latestCrash = rounds.filter(r => r.crashAt <= now).at(-1);
      const historyChanged = latestCrash?.id !== historyKey;
      if (historyChanged) historyKey = latestCrash?.id ?? -Infinity;
      const history = historyChanged ? rounds.filter(r => r.crashAt <= now).slice(-20).reverse().map(r => ({ value: r.crash, time: new Date(r.crashAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })) : s.history;
      let players = roundChanged ? makePlayers() : s.players;
      if (phase === 'FLYING') players = players.map(p => !p.cashed && multiplier >= p.target ? { ...p, cashed: true } : p);
      s.set({ syncReady: true, roundId: round.id, phase, multiplier, countdown: phase === 'WAITING' ? Math.max(0, Math.ceil((round.flightStart - now) / 1000)) : 0,
        bets, balance, history, players, ...(roundChanged ? { online: 2050 + Math.floor(Math.random() * 110) } : {}) });
      if (reportedOffline) { reportedOffline = false; s.notify('Manche synchronisée.', 'success'); }
      const notes: string[] = [];
      if (autoCount) { notes.push(`Encaissement auto : $ ${money(autoGain)} à ${s.autoTarget.toFixed(2)}x.`); playSound('cash', s.sound); }
      if (lostCount) notes.push(`${lostCount > 1 ? 'Mises perdues' : 'Mise perdue'} : $ ${money(lostTotal)}.`);
      if (refunded) notes.push(`Mises remboursées après déconnexion : $ ${money(refunded)}.`);
      if (replayed) notes.push('Jeu auto : mises replacées.');
      if (skipped) notes.push('Solde insuffisant pour certaines mises.');
      if (notes.length) s.notify(notes.join(' '), lostCount || skipped ? 'error' : 'success');
      if (!firstSync && phaseChanged && phase === 'CRASHED') playSound('crash', s.sound);
      if (phase === 'WAITING') {
        const tick = Math.ceil((round.flightStart - now) / 1000);
        if (tick !== lastTick && tick > 0) { lastTick = tick; playSound('tick', s.sound); }
      } else lastTick = -1;
      updateEngine(s.sound && phase === 'FLYING' && document.visibilityState === 'visible', multiplier);
      return true;
    };
    useGame.setState({ syncReady: false, syncNow });
    refresh = async () => {
      if (inflight || stopped) return;
      inflight = true;
      const before = performance.now();
      try {
        const response = await fetch('/api/round', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Clock request failed');
        const data: { serverTime: number; rounds: SharedRound[] } = await response.json();
        const after = performance.now();
        if (stopped || !Number.isFinite(data.serverTime) || !Array.isArray(data.rounds) || !data.rounds.length) return;
        if (document.visibilityState !== 'visible') return;
        const authoritativeRound = data.rounds.find(r => r.start <= data.serverTime && data.serverTime < r.end);
        if (!authoritativeRound) return;
        rounds = data.rounds; snapshotRoundId = authoritativeRound.id; serverAnchor = data.serverTime + (after - before) / 2; perfAnchor = after; needsSync = false;
        useGame.setState({ ping: Math.round(after - before) });
        syncNow();
      } catch { /* The previous clock remains valid for a short grace period. */ }
      finally { inflight = false; }
    };
    const unlock = () => { unlockAudio(); setAudioEnabled(useGame.getState().sound); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    const unsubscribeSound = useGame.subscribe((state, previous) => { if (state.sound !== previous.sound) setAudioEnabled(state.sound); });
    const onVisibility = () => { stopEngine(); needsSync = true; useGame.setState({ syncReady: false }); if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 3000);
    const loop = () => { if (!stopped) { syncNow(); frame = requestAnimationFrame(loop); } };
    frame = requestAnimationFrame(loop);
    return () => { stopped = true; stopEngine(); unsubscribeSound(); window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); controller.abort(); clearInterval(interval); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('focus', onVisibility); useGame.setState({ syncReady: false, syncNow: () => false }); };
  }, []);
}
