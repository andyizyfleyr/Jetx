'use client';
import { useEffect, useRef } from 'react';
import { useGame, type Phase } from '@/store/game';
import { flightVisual } from '@/lib/flightVisual';

// The background plates and jet are original local artwork; Canvas adds parallax and motion.
export default function CanvasFallback() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const sky = new Image(); sky.src = '/sky-flight.jpg';
    const space = new Image(); space.src = '/sky-space.jpg';
    const jet = new Image(); jet.src = '/jet.webp';
    const cloud = new Image(); cloud.src = '/cloud.webp';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousPhase: Phase = useGame.getState().phase;
    let spaceMix = previousPhase === 'CRASHED' ? 1 : 0;
    let previousTime = performance.now();
    const start = performance.now();

    function cover(image: HTMLImageElement, w: number, h: number, drift: number, ascent = 0, isSky = false) {
      if (!image.complete || !image.naturalWidth) return;
      // Overscan prevents any blank edges while the atmospheric plate drifts.
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight) * (isSky ? 1.35 : 1.12);
      const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
      ctx!.drawImage(image, (w - iw) / 2 + drift * Math.max(0, iw-w)*.35, (h - ih) / 2 + (isSky ? (ascent*2-1)*Math.max(0,ih-h)*.4 : 0), iw, ih);
    }
    function parachute(x: number, y: number, size: number, sway: number) {
      const c = ctx!; c.save(); c.translate(x, y); c.scale(size, size); c.rotate(sway);
      // A shaded, segmented canopy and fine suspension lines create depth at a small scale.
      const canopy = c.createLinearGradient(0, -16, 0, 5);
      canopy.addColorStop(0, 'rgba(145,138,161,.8)'); canopy.addColorStop(1, 'rgba(44,40,64,.86)');
      c.fillStyle = canopy; c.beginPath(); c.moveTo(-22, 0); c.bezierCurveTo(-21, -22, 21, -22, 22, 0); c.quadraticCurveTo(16, 4, 11, 0); c.quadraticCurveTo(5, 4, 0, 0); c.quadraticCurveTo(-6, 4, -11, 0); c.quadraticCurveTo(-17, 4, -22, 0); c.fill();
      c.strokeStyle = 'rgba(218,205,215,.3)'; c.lineWidth = .5; c.beginPath(); c.moveTo(-11,0); c.quadraticCurveTo(-10,-15,0,-16); c.quadraticCurveTo(10,-15,11,0); c.moveTo(0,-16); c.lineTo(0,0); c.stroke();
      c.strokeStyle = 'rgba(35,32,45,.7)'; c.lineWidth = .6; c.beginPath(); c.moveTo(-21,1); c.lineTo(0,26); c.lineTo(21,1); c.moveTo(-10,1); c.lineTo(0,26); c.lineTo(10,1); c.stroke();
      c.fillStyle = '#3d3949'; c.beginPath(); c.arc(0,26,2.2,0,Math.PI*2); c.fill(); c.fillRect(-2,29,4,7); c.strokeStyle='#3d3949'; c.lineWidth=1.5; c.beginPath(); c.moveTo(-1,35); c.lineTo(-4,41); c.moveTo(1,35); c.lineTo(4,40); c.stroke(); c.restore();
    }
    function astronaut(x:number, y:number, size:number, angle:number) {
      const c=ctx!; c.save(); c.translate(x,y); c.rotate(angle); c.scale(size,size);
      c.fillStyle='#b5c5d9'; c.fillRect(-8,-1,16,19); c.fillStyle='#d8e2ef'; c.beginPath(); c.roundRect(-7,-2,14,20,4); c.fill();
      c.strokeStyle='#c1d1e2'; c.lineCap='round'; c.lineWidth=5; c.beginPath(); c.moveTo(-6,3); c.lineTo(-13,9); c.moveTo(6,3); c.lineTo(12,8); c.moveTo(-4,16); c.lineTo(-7,27); c.moveTo(4,16); c.lineTo(8,25); c.stroke();
      c.fillStyle='#e5eef8'; c.beginPath(); c.arc(0,-8,8,0,Math.PI*2); c.fill(); c.fillStyle='#344f72'; c.beginPath(); c.ellipse(1,-8,5.5,4.5,0,0,Math.PI*2); c.fill(); c.fillStyle='#ffffff88'; c.beginPath(); c.ellipse(-1,-10,2,1,0,0,Math.PI*2); c.fill(); c.restore();
    }
    const draw = (now: number) => {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) { canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      const { phase, animations, multiplier } = useGame.getState();
      const moving = animations && !reduced.matches;
      const t = moving ? (now-start)/1000 : 0;
      const { seconds: travel, ascent, entrance } = flightVisual(multiplier, moving);
      if (phase !== previousPhase) { previousPhase = phase; }
      const delta = Math.min(100, now-previousTime); previousTime = now;
      const target = phase === 'CRASHED' ? 1 : 0;
      spaceMix = moving ? spaceMix + (target-spaceMix)*Math.min(1,delta/420) : target;
      ctx.fillStyle='#182039'; ctx.fillRect(0,0,w,h);
      cover(sky,w,h,Math.sin(travel*.09),ascent,true);
      ctx.save(); ctx.globalAlpha=spaceMix; cover(space,w,h,Math.sin(t*.04)); ctx.restore();
      // Slight darkening protects the legibility of the multiplier and labels.
      const shade=ctx.createLinearGradient(0,0,0,h); shade.addColorStop(0,'rgba(9,13,26,.24)'); shade.addColorStop(.55,'rgba(16,17,31,.05)'); shade.addColorStop(1,'rgba(13,13,24,.35)'); ctx.fillStyle=shade; ctx.fillRect(0,0,w,h);
      ctx.save(); ctx.globalAlpha=1-spaceMix;
      if (cloud.complete && cloud.naturalWidth) for(let i=0;i<5;i++) { const cw=w*(.5+(i%3)*.18), ch=cw*cloud.naturalHeight/cloud.naturalWidth; const x=((i*w*.37-travel*(24+i*9))%(w+cw)+w+cw)%(w+cw)-cw/2; const y=h*(.25+(i%3)*.16)+ascent*h*(.1+i*.025); ctx.save(); ctx.globalAlpha=(1-spaceMix)*[.20,.27,.18,.25,.16][i]; ctx.drawImage(cloud,x-cw/2,y-ch/2,cw,ch); ctx.restore(); }
      for(let i=0;i<5;i++) { const x=w*(.08+i*.22)+Math.sin(t*.3+i)*4-travel*(1+i*.3); const y=h*.27+((travel*(3+i*.5)+i*19)%(h*.25)); parachute(x,y,.42+(i%3)*.1,Math.sin(t*.6+i)*.05); }
      if (phase === 'FLYING' && jet.complete && jet.naturalWidth) {
        const x=w*(.40+entrance*.10+ascent*.03)+Math.sin(t*.7)*3, y=h*(.44-entrance*.025-ascent*.035)+Math.sin(t*1.2)*2;
        const jw=w*.68, jh=jw*jet.naturalHeight/jet.naturalWidth;
        ctx.save(); ctx.translate(x,y); ctx.rotate(-.09-ascent*.08); ctx.shadowColor='rgba(255,155,66,.3)'; ctx.shadowBlur=10; ctx.drawImage(jet,-jw*.5,-jh*.5,jw,jh); ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.globalAlpha=spaceMix*.8;
      for(let i=0;i<3;i++) astronaut(w*(.12+i*.38)+Math.sin(t*.35+i)*7,h*(.31+i*.1)+Math.cos(t*.3+i)*5,.45+i*.1, .3+i*.6+Math.sin(t*.3)*.1);
      ctx.restore();
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="game-canvas" aria-hidden="true" />;
}
