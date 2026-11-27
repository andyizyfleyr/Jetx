'use client';
import { useEffect, useRef } from 'react';
import { useGame } from '@/store/game';

// Original vector artwork drawn directly into a responsive Canvas 2D scene.
export default function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0; const start = performance.now();
    const draw = (now: number) => {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { phase, animations } = useGame.getState(); const t = animations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? (now - start) / 1000 : 0;
      if (phase === 'CRASHED') {
        const bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#10162f'); bg.addColorStop(.55, '#314d88'); bg.addColorStop(1, '#0b1024'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.translate(w*.35, h*.31); ctx.rotate(-.6); const beam = ctx.createLinearGradient(0, -h*.3, 0, h*.3); beam.addColorStop(0, 'transparent'); beam.addColorStop(.5, 'rgba(130,174,255,.13)'); beam.addColorStop(1, 'transparent'); ctx.fillStyle = beam; ctx.fillRect(-w, -h*.3, w*3, h*.6); ctx.restore();
        for (let i=0;i<35;i++) { ctx.fillStyle = `rgba(255,255,255,${.08+(i%3)*.06})`; ctx.beginPath(); ctx.arc((i*113)%w, (i*67)%h, i%5===0?1.3:.6, 0, Math.PI*2); ctx.fill(); }
        for (let i=0;i<3;i++) { const x = (i*145+20 + Math.sin(t*.4+i)*9)%w, y = h*.26+i*23+Math.cos(t*.5+i)*5; ctx.save(); ctx.translate(x,y); ctx.rotate(.3+i); ctx.fillStyle='#a7b5d3'; ctx.beginPath(); ctx.arc(0,-7,5,0,7); ctx.fill(); ctx.fillRect(-4,0,8,12); ctx.strokeStyle='#a7b5d3'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-3,3); ctx.lineTo(-9,7); ctx.moveTo(3,3); ctx.lineTo(9,6); ctx.moveTo(-2,11); ctx.lineTo(-5,18); ctx.moveTo(2,11); ctx.lineTo(6,18); ctx.stroke(); ctx.restore(); }
      } else {
        const bg = ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,'#202944'); bg.addColorStop(.45,'#796983'); bg.addColorStop(.75,'#b67e85'); bg.addColorStop(1,'#30232d'); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
        for(let i=0;i<7;i++){ const x=((i*133-t*(i%2?3:7))%(w+220)+w+220)%(w+220)-110, y=h*(.32+(i%3)*.12); const cloud=ctx.createRadialGradient(x,y,0,x,y,100); cloud.addColorStop(0,'rgba(235,177,181,.19)'); cloud.addColorStop(1,'transparent'); ctx.fillStyle=cloud; ctx.fillRect(x-100,y-100,200,200); }
        for(let i=0;i<5;i++){ const x=45+i*83, y=h*.28+((t*4+i*25)%90); ctx.save(); ctx.translate(x,y); ctx.fillStyle='rgba(55,48,80,.45)'; ctx.beginPath(); ctx.ellipse(0,0,22,13,0,Math.PI,0); ctx.fill(); ctx.strokeStyle='rgba(49,45,68,.38)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-21,0); ctx.lineTo(0,24); ctx.lineTo(21,0); ctx.stroke(); ctx.fillRect(-2,23,4,9); ctx.restore(); }
        if (phase === 'FLYING') { ctx.save(); ctx.translate(w*.54+Math.sin(t*.6)*8,h*.43+Math.sin(t)*3); ctx.rotate(-.27); const flame=ctx.createLinearGradient(-100,0,-48,0); flame.addColorStop(0,'transparent'); flame.addColorStop(.6,'#ff9430'); flame.addColorStop(1,'#fff6a5'); ctx.fillStyle=flame; ctx.beginPath(); ctx.moveTo(-105-Math.sin(t*15)*8,0); ctx.lineTo(-42,-6); ctx.lineTo(-42,6); ctx.fill(); ctx.fillStyle='#e8e8dc'; ctx.beginPath(); ctx.moveTo(-51,-7); ctx.lineTo(42,-12); ctx.lineTo(91,0); ctx.lineTo(38,9); ctx.lineTo(-51,7); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffd400'; ctx.beginPath(); ctx.moveTo(-45,-6); ctx.lineTo(-58,-24); ctx.lineTo(-35,-22); ctx.lineTo(-13,-7); ctx.lineTo(13,-7); ctx.lineTo(-3,-25); ctx.lineTo(12,-23); ctx.lineTo(39,-8); ctx.lineTo(91,0); ctx.lineTo(43,3); ctx.lineTo(15,20); ctx.lineTo(-5,21); ctx.lineTo(8,6); ctx.lineTo(-35,7); ctx.lineTo(-52,20); ctx.lineTo(-62,19); ctx.closePath(); ctx.fill(); ctx.fillStyle='#20252b'; ctx.beginPath(); ctx.moveTo(5,-9); ctx.lineTo(37,-14); ctx.lineTo(57,-5); ctx.lineTo(12,-4); ctx.fill(); ctx.restore(); }
      }
      frame=requestAnimationFrame(draw);
    }; frame=requestAnimationFrame(draw); return()=>cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="game-canvas" aria-hidden="true" />;
}
