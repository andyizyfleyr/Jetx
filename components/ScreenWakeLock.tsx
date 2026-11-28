'use client';
import { useEffect } from 'react';

// Wake locks are advisory: browsers can refuse or release them at any time.
export default function ScreenWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    let requesting = false;
    const acquire = async () => {
      if (disposed || requesting || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      requesting = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (disposed || document.visibilityState !== 'visible') { await sentinel.release(); return; }
        lock = sentinel;
        sentinel.addEventListener('release', () => { if (lock === sentinel) lock = null; });
      } catch { /* Unsupported, denied or low battery: normal browser behavior. */ }
      finally { requesting = false; }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', acquire);
    return () => { disposed = true; document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('pointerdown', acquire); void lock?.release(); };
  }, []);
  return null;
}
