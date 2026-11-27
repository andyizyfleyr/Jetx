'use client';
import { useEffect } from 'react';
import { useGame } from '@/store/game';
import { playSound } from '@/lib/audio';

export function useGameEngine() {
  useEffect(() => {
    const game = useGame.getState(); game.startWaiting();
    let frame = 0, phaseStart = performance.now(), lastPhase = 'WAITING', crashPoint = 1, lastTick = -1, lastEngine = 0;
    const loop = (now: number) => {
      const s = useGame.getState();
      if (s.phase !== lastPhase) { lastPhase = s.phase; phaseStart = now; lastTick = -1; }
      const elapsed = now - phaseStart;
      if (s.phase === 'WAITING') {
        const remaining = Math.max(0, Math.ceil(5 - elapsed / 1000));
        if (remaining !== s.countdown) s.set({ countdown: remaining });
        if (remaining !== lastTick && remaining > 0) { lastTick = remaining; playSound('tick', s.sound); }
        if (elapsed >= 5000) { crashPoint = Math.min(1000, Math.max(1, .97 / (1 - Math.random()))); s.startFlight(); }
      } else if (s.phase === 'FLYING') {
        const multiplier = Math.exp(.00006 * elapsed);
        if (multiplier >= crashPoint) {
          const lost = s.bets.map((bet, i) => bet.status === 'active' ? i + 1 : 0).filter(Boolean);
          const total = s.bets.reduce((sum, bet) => sum + (bet.status === 'active' ? bet.amount : 0), 0);
          s.set({ multiplier: crashPoint }); s.crash(); playSound('crash', s.sound);
          if (lost.length) s.notify(`${lost.length > 1 ? 'Mises perdues' : 'Mise perdue'} : $ ${total.toFixed(2)}.`, 'error');
        }
        else {
          const players = s.players.map(p => !p.cashed && multiplier >= p.target ? { ...p, cashed: true } : p);
          s.set({ multiplier, players });
          if (s.autoCash && multiplier >= s.autoTarget) { const current = useGame.getState(); const count = current.bets.filter(b => b.status === 'active').length; const gain = current.cashAll(); if (gain) { playSound('cash', s.sound); current.notify(`Encaissement auto : ${count} mise${count > 1 ? 's' : ''}, $ ${gain.toFixed(2)} à ${multiplier.toFixed(2)}x.`, 'success'); } }
          if (now - lastEngine > 800) { lastEngine = now; playSound('engine', s.sound); }
        }
      } else if (elapsed >= 3000) {
        const eligible = s.autoPlay ? s.bets.map((bet, i) => bet.status === 'empty' && bet.lastAmount > 0 ? i : -1).filter(i => i >= 0) : [];
        s.startWaiting();
        if (eligible.length) {
          const next = useGame.getState();
          const placed = eligible.filter(i => next.bets[i].status === 'queued');
          const skipped = eligible.filter(i => next.bets[i].status === 'empty');
          const replay = placed.length ? `Jeu auto : mise${placed.length > 1 ? 's' : ''} replacée${placed.length > 1 ? 's' : ''}.` : '';
          const insufficient = skipped.length ? ' Solde insuffisant pour certaines mises.' : '';
          next.notify((replay + insufficient).trim(), skipped.length ? 'error' : 'info');
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, []);
}
