'use client';

import { useEffect } from 'react';

/** Keep the screen awake only while the game is visible and the browser allows it. */
export function useScreenWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let pending = false;
    let stopped = false;
    let generation = 0;

    async function acquire() {
      if (stopped || pending || lock || document.visibilityState !== 'visible') return;
      pending = true;
      const requestGeneration = generation;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (stopped || requestGeneration !== generation || document.visibilityState !== 'visible') {
          await acquired.release();
          return;
        }
        lock = acquired;
        acquired.addEventListener('release', () => { if (lock === acquired) lock = null; });
      } catch {
        // Browser policies, battery saver, or an insecure context may deny the request.
      } finally {
        pending = false;
        // A visibility change can occur while the permission request is pending.
        if (!stopped && requestGeneration !== generation && document.visibilityState === 'visible') void acquire();
      }
    }
    function onVisibility() {
      generation++;
      if (document.visibilityState === 'visible') void acquire();
      else if (lock) { const previous = lock; lock = null; void previous.release().catch(() => {}); }
    }
    document.addEventListener('visibilitychange', onVisibility);
    void acquire();
    return () => {
      stopped = true;
      generation++;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock) { const previous = lock; lock = null; void previous.release().catch(() => {}); }
    };
  }, []);
}
