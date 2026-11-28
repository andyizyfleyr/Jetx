'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 100;

// A gesture may refresh only when the page and every scrollable ancestor are at the top.
function canPull(target: EventTarget | null) {
  if (!(target instanceof Element) || target.closest('input, textarea, select, [role="dialog"], [role="listbox"], [contenteditable="true"]')) return false;
  if (window.scrollY > 0) return false;
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight && node.scrollTop > 0) return false;
  }
  return true;
}

export default function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef<{ x: number; y: number; distance: number; active: boolean } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reloading = false;
    const start = (event: TouchEvent) => {
      if (reloading || event.touches.length !== 1 || !canPull(event.target)) { gesture.current = null; return; }
      gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, distance: 0, active: true };
    };
    const move = (event: TouchEvent) => {
      const g = gesture.current;
      if (!g || !g.active || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - g.x, dy = event.touches[0].clientY - g.y;
      if (dy < -8 || (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy))) { g.active = false; setDistance(0); return; }
      if (!canPull(event.target)) { g.active = false; setDistance(0); return; }
      g.distance = Math.max(0, dy);
      setDistance(Math.min(g.distance * .55, 70));
    };
    const end = () => {
      const g = gesture.current;
      gesture.current = null;
      if (g?.active && g.distance >= THRESHOLD) {
        reloading = true; setRefreshing(true); setDistance(55);
        timer = setTimeout(() => window.location.reload(), 350);
      } else setDistance(0);
    };
    const cancel = () => { gesture.current = null; setDistance(0); };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel);
    };
  }, []);
  const ready = distance >= THRESHOLD * .55;
  return <div className={`pull-refresh${refreshing ? ' is-refreshing' : ''}`} aria-hidden={!distance} role="status" style={{ transform: `translate(-50%, ${distance - 70}px)`, opacity: distance > 8 ? 1 : 0 }}>
    <RefreshCw size={17} style={{ transform: refreshing ? undefined : `rotate(${distance * 4}deg)` }} />
    <span>{refreshing ? 'Actualisation…' : ready ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}</span>
  </div>;
}
