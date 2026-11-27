'use client';

import { useEffect, useRef } from 'react';
import { useGame, type Phase } from '@/store/game';
import CanvasFallback from './CanvasFallback';

/** Pixi runs only in the browser. The original Canvas scene remains underneath as
 * a graceful fallback on devices without WebGL or if an asset cannot load. */
export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    async function start() {
      const element = host.current;
      if (!element) return;
      const { Application, Assets, Container, Graphics, Sprite } = await import('pixi.js');
      if (disposed) return;
      const app = new Application();
      await app.init({ resizeTo: element, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), preference: 'webgl' });
      if (disposed) { app.destroy(true); return; }
      cleanup = () => app.destroy(true, { children: true });
      const [skyTexture, spaceTexture, cloudTexture, planeTexture] = await Promise.all([
        Assets.load('/sky-flight.jpg'), Assets.load('/sky-space.jpg'), Assets.load('/cloud.webp'), Assets.load('/plane.webp'),
      ]);
      if (disposed) return;
      const sky = new Sprite(skyTexture), space = new Sprite(spaceTexture);
      const clouds = new Container(), flight = new Container(), parachutes = new Container(), stars = new Container();
      sky.anchor.set(.5); space.anchor.set(.5);
      app.stage.addChild(sky, space, clouds, parachutes, flight, stars);
      const cloudSprites = Array.from({ length: 5 }, (_, i) => {
        const sprite = new Sprite(cloudTexture); sprite.anchor.set(.5); sprite.alpha = [.20,.27,.18,.25,.16][i]; clouds.addChild(sprite); return sprite;
      });
      // Fine suspension lines and shaded canopy shapes are independent display objects.
      const divers = Array.from({ length: 5 }, (_, i) => {
        const diver = new Graphics();
        diver.moveTo(-20, 0).bezierCurveTo(-19,-19,19,-19,20,0).quadraticCurveTo(15,3,10,0).quadraticCurveTo(5,3,0,0).quadraticCurveTo(-5,3,-10,0).quadraticCurveTo(-15,3,-20,0).fill({ color: i % 2 ? 0x777181 : 0x4b465d, alpha: .85 });
        diver.moveTo(-20,0).lineTo(0,25).lineTo(20,0).moveTo(-10,0).lineTo(0,25).lineTo(10,0).stroke({ color: 0xccc3ce, alpha: .5, width: .7 });
        diver.circle(0,27,2.5).fill(0x252431).roundRect(-2,29,4,7,1).fill(0x252431).moveTo(-1,35).lineTo(-4,41).moveTo(1,35).lineTo(4,41).stroke({color:0x252431,width:2});
        parachutes.addChild(diver); return diver;
      });
      const flame = new Graphics(), plane = new Sprite(planeTexture);
      plane.anchor.set(.5); flight.addChild(flame, plane);
      const astronauts = Array.from({ length: 3 }, () => {
        const figure = new Graphics();
        figure.roundRect(-8,-1,16,19,4).fill(0xa7b9ce).roundRect(-6,0,12,17,3).fill(0xd7e4f1);
        figure.moveTo(-6,3).lineTo(-13,9).moveTo(6,3).lineTo(12,8).moveTo(-4,16).lineTo(-7,27).moveTo(4,16).lineTo(8,25).stroke({color:0xc9d9e9,width:5,cap:'round'});
        figure.circle(0,-8,8).fill(0xe5eff8).ellipse(1,-8,5.5,4.5).fill(0x344f72).ellipse(-1,-10,2,1).fill({color:0xffffff,alpha:.55});
        stars.addChild(figure); return figure;
      });
      const sparks = Array.from({ length: 24 }, (_, i) => { const dot = new Graphics().circle(0,0,i % 5 === 0 ? 1.4 : .7).fill({color:0xc9dcff,alpha:.7}); stars.addChild(dot); return dot; });
      element.appendChild(app.canvas);
      app.canvas.className = 'pixi-canvas';
      let phase: Phase = useGame.getState().phase;
      let phaseStart = performance.now(), last = phaseStart, clock = 0, spaceMix = phase === 'CRASHED' ? 1 : 0;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      app.ticker.add(() => {
        const now = performance.now(), delta = Math.min((now-last)/1000,.05); last = now;
        const state = useGame.getState(), moving = state.animations && !reduced.matches;
        if (moving) clock += delta;
        if (state.phase !== phase) { phase=state.phase; phaseStart=now; }
        const elapsed = moving ? (now-phaseStart)/1000 : 10;
        spaceMix += ((phase === 'CRASHED' ? 1 : 0)-spaceMix) * (moving ? Math.min(1,delta*3) : 1);
        const w=app.screen.width, h=app.screen.height;
        const cover = (sprite: InstanceType<typeof Sprite>) => { const scale=Math.max(w/sprite.texture.width,h/sprite.texture.height)*1.12; sprite.scale.set(scale); sprite.position.set(w/2+Math.sin(clock*.08)*w*.012,h/2); };
        cover(sky); cover(space); space.alpha=spaceMix;
        clouds.alpha = 1-spaceMix;
        cloudSprites.forEach((sprite,i) => { const cw=w*(.5+(i%3)*.18); sprite.width=cw; sprite.height=cw*cloudTexture.height/cloudTexture.width; sprite.x=((i*w*.37-clock*(3+i*1.8))%(w+cw)+w+cw)%(w+cw)-cw/2; sprite.y=h*(.28+(i%3)*.16); });
        parachutes.alpha=1-spaceMix;
        divers.forEach((diver,i)=>{diver.scale.set(.45+(i%3)*.12); diver.x=w*(.08+i*.21)+Math.sin(clock*.4+i)*5; diver.y=h*.25+((clock*(2+i*.4)+i*19)%(h*.28)); diver.rotation=Math.sin(clock*.6+i)*.06;});
        stars.alpha=spaceMix; astronauts.forEach((figure,i)=>{figure.position.set(w*(.12+i*.38)+Math.sin(clock*.35+i)*7,h*(.31+i*.1)+Math.cos(clock*.3+i)*5); figure.scale.set(.45+i*.1); figure.rotation=.3+i*.6+Math.sin(clock*.3)*.1;}); sparks.forEach((dot,i)=>{dot.x=(i*83+17)%w; dot.y=(i*53+19)%h; dot.alpha=.25+.5*(.5+.5*Math.sin(clock*1.1+i));});
        const progress=Math.min(1,elapsed/1.7); const escaping=phase==='CRASHED' ? Math.min(1,elapsed/.5) : 0;
        flight.visible=phase==='FLYING'||(phase==='CRASHED'&&elapsed<.5); flight.alpha=phase==='CRASHED'?1-escaping:1;
        flight.position.set(w*(.40+.13*progress+escaping*.85)+Math.sin(clock*.9)*4,h*(.43-.06*progress-escaping*.25)+Math.sin(clock*1.1)*3);
        flight.rotation=-.12-Math.sin(clock*.7)*.025; plane.width=w*.58; plane.height=plane.width*planeTexture.height/planeTexture.width;
        // Flame is a separate, flickering geometry layer, not baked into the jet image.
        const tail=-plane.width*.47, flicker=moving?Math.sin(clock*21)*w*.014:0;
        flame.clear().poly([tail+3,0,tail-w*.23-flicker,0,tail-w*.06,-w*.023]).fill({color:0xff6922,alpha:.35}).poly([tail+3,0,tail-w*.18-flicker,0,tail-w*.035,-w*.011]).fill({color:0xffbe52,alpha:.85}).poly([tail+3,0,tail-w*.1-flicker*.5,0,tail-w*.02,-w*.005]).fill({color:0xfff5b0,alpha:.95});
      });
    }
    start().catch(() => { cleanup?.(); cleanup = undefined; });
    return () => { disposed = true; cleanup?.(); };
  }, []);
  return <><CanvasFallback /><div ref={host} className="pixi-host" aria-hidden="true" /></>;
}
