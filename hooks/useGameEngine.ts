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
        if (multiplier >= crashPoint) { s.set({ multiplier: crashPoint }); s.crash(); playSound('crash', s.sound); }
        else {
          const players = s.players.map(p => !p.cashed && multiplier >= p.target ? { ...p, cashed: true } : p);
          s.set({ multiplier, players });
          if (s.autoCash && multiplier >= s.autoTarget) { const gain = useGame.getState().cashAll(); if (gain) playSound('cash', s.sound); }
          if (now - lastEngine > 800) { lastEngine = now; playSound('engine', s.sound); }
        }
      } else if (elapsed >= 3000) s.startWaiting();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, []);
}
