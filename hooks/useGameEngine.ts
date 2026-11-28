'use client';
import { useEffect } from 'react';
import { useGame, makePlayers, type Phase } from '@/store/game';
import { playSound, setAudioEnabled, stopEngine, unlockAudio, updateEngine } from '@/lib/audio';
import type { SharedRound } from '@/lib/sharedRounds';
import { refreshSky } from '@/lib/centralSky';

const MAX_CLOCK_AGE = 20000;

/** Interpolate against server UTC, never against the player's wall clock. */
export function useGameEngine() {
  useEffect(() => {
    let frame = 0, stopped = false, inflight = false, needsSync = true, serverAnchor = 0, perfAnchor = 0;
    let rounds: SharedRound[] = [];
    let snapshotRoundId: number | undefined;
    let refresh: () => Promise<void> = async () => {};
    let historyKey = -Infinity, lastTick=-1, serverReady = false;
    const controller = new AbortController();

    const syncNow = (): boolean => {
      const s = useGame.getState();
      const nowPerf = performance.now();
      if (needsSync || !rounds.length || nowPerf - perfAnchor > MAX_CLOCK_AGE) {
        stopEngine();
        if (s.syncReady) s.set({ syncReady: false });
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
      {
        const roundChanged=s.roundId!==round.id;
        const latestCrash=rounds.filter(r=>r.crashAt<=now).at(-1);
        const key=latestCrash?.id??-Infinity;
        const history=key!==historyKey ? rounds.filter(r=>r.crashAt<=now).slice(-20).reverse().map(r=>({value:r.crash,time:new Date(r.crashAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})})) : s.history;
        historyKey=key;
        let players=roundChanged?makePlayers():s.players;
        if(phase==='FLYING' && players.some(p=>!p.cashed&&multiplier>=p.target))players=players.map(p=>!p.cashed&&multiplier>=p.target?{...p,cashed:true}:p);
        const countdown=phase==='WAITING'?Math.max(0,Math.ceil((round.flightStart-now)/1000)):0;
        if(s.syncReady!==serverReady || roundChanged || s.phase!==phase || s.multiplier!==multiplier || s.countdown!==countdown || s.history!==history || s.players!==players){
          s.set({syncReady:serverReady,roundId:round.id,phase,multiplier,countdown,history,players, ...(roundChanged?{online:2050+Math.floor(Math.random()*110)}:{})});
        }
        if(s.roundId>=0 && (s.phase!==phase || roundChanged)) {
          if(phase==='CRASHED')playSound('crash',s.sound);
          // Refresh bet state immediately when a round changes phase instead of
          // leaving the cash-out controls waiting for the next scheduled poll.
          void refresh();
        }
        if(phase==='WAITING'){const tick=Math.ceil((round.flightStart-now)/1000);if(tick!==lastTick&&tick>0){lastTick=tick;playSound('tick',s.sound);}}else lastTick=-1;
        updateEngine(s.sound&&phase==='FLYING'&&document.visibilityState==='visible',multiplier);
        return serverReady;
      }

    };
    useGame.setState({ syncReady: false, syncNow });
    refresh = async () => {
      if (inflight || stopped) return;
      inflight = true;
      try {
        // These independent requests run together. Clock latency is measured
        // from the clock request alone, not from the wallet request before it.
        const sky = refreshSky().then(()=>true,()=>false);
        const before = performance.now();
        const response = await fetch('/api/round', { cache: 'no-store', signal: controller.signal });
        const data: { serverTime: number; rounds: SharedRound[] } = await response.json();
        const after = performance.now();
        serverReady=await sky;
        if(!serverReady)useGame.setState({syncReady:false});
        if (!response.ok) throw new Error('Clock request failed');
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
    // Try immediately when the browser permits autoplay; gestures remain the fallback.
    if (useGame.getState().sound) unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    const unsubscribeSound = useGame.subscribe((state, previous) => { if (state.sound !== previous.sound) { if (state.sound) unlockAudio(); setAudioEnabled(state.sound); } });
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
