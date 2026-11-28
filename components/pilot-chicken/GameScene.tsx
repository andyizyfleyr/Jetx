'use client';
import { useEffect, useRef } from 'react';
import type { Difficulty } from '@/lib/pilot-chicken/format';
import { multiplierAt } from '@/lib/pilot-chicken/format';
import { gsap } from 'gsap';

type SceneState = { step:number; phase:'idle'|'playing'|'won'|'lost'; difficulty:Difficulty };
export default function GameScene(props:SceneState){
 const host=useRef<HTMLDivElement>(null);const state=useRef(props);useEffect(()=>{state.current=props;},[props]);
 useEffect(()=>{let disposed=false;let cleanup:(()=>void)|undefined;
  async function start(){const element=host.current;if(!element)return;const {Application,Assets,Container,Graphics,Sprite,Text}=await import('pixi.js');const app=new Application();await app.init({resizeTo:element,background:'#242130',antialias:true,autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,2)});if(disposed){app.destroy(true);return;}
   cleanup=()=>app.destroy(true,{children:true});
   const [runwayTexture,startTexture,chickenTexture,planeTexture]=await Promise.all(['/assets/pilot-chicken/runway.jpg','/assets/pilot-chicken/start-zone.webp','/assets/pilot-chicken/chicken.webp','/assets/pilot-chicken/obstacle.webp'].map(url=>Assets.load(url)));if(disposed){cleanup?.();cleanup=undefined;return;}
   element.appendChild(app.canvas);app.canvas.setAttribute('aria-hidden','true');const world=new Container();app.stage.addChild(world);const bg=new Sprite(runwayTexture);bg.width=4300;bg.height=480;bg.alpha=.7;world.addChild(bg);
   const startArea=new Sprite(startTexture);startArea.width=235;startArea.height=480;world.addChild(startArea);
   const track=new Graphics();for(let i=0;i<24;i++){const x=305+i*164;for(let j=0;j<3;j++){track.roundRect(x-5,36+j*85,10,48,3).fill({color:0x8e8b9e,alpha:.36}).stroke({color:0xc9c4d5,alpha:.18,width:1});}}world.addChild(track);
   const coins=Array.from({length:24},(_,i)=>{const layer=new Container();layer.x=305+i*164;layer.y=398;const disk=new Graphics();layer.addChild(disk);const label=new Text({text:'1.05x',style:{fontFamily:'Arial',fontSize:22,fontWeight:'900',fill:'#ffffff',stroke:{color:'#24212d',width:4},dropShadow:{color:'#000000',blur:3,distance:2}}});label.anchor.set(.5);layer.addChild(label);world.addChild(layer);return {disk,label};});
   const decorative=[3,6,10,15,19,22].map((n,i)=>{const plane=new Sprite(planeTexture);plane.anchor.set(.5);plane.width=130;plane.height=100;plane.x=305+n*164;plane.y=i%2?150:220;plane.alpha=.48;world.addChild(plane);return plane;});void decorative;
   const shadow=new Graphics().ellipse(0,0,57,13).fill({color:0x080715,alpha:.38});const chicken=new Sprite(chickenTexture);chicken.anchor.set(.5,1);chicken.width=124;chicken.height=186;world.addChild(shadow,chicken);const impact=new Sprite(planeTexture);impact.anchor.set(.5);impact.width=144;impact.height=110;impact.visible=false;world.addChild(impact);
   const particles=new Graphics();world.addChild(particles);let lastStep=-1,lastPhase='',lastDifficulty='',phaseStart=performance.now(),stepStart=performance.now();const camera={x:0};let tween:gsap.core.Tween|undefined,position=142;let shake=0;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
   app.ticker.add(()=>{const s=state.current,now=performance.now(),h=app.screen.height,w=app.screen.width,scale=h/480;world.scale.set(scale);const view=w/scale;
    if(lastStep!==s.step||lastDifficulty!==s.difficulty||lastPhase!==s.phase){const previous=lastStep; if(lastPhase!==s.phase){phaseStart=now;if(s.phase==='lost')shake=1;}
      if(lastStep!==s.step){stepStart=now;const target=s.step===0?142:305+(s.step-1)*164;tween?.kill();tween=gsap.to({v:position},{v:target,duration:reduce.matches?.01:.48,ease:'power2.inOut',onUpdate:function(){position=this.targets()[0].v;}});}
      if(lastStep!==s.step||lastDifficulty!==s.difficulty||lastPhase!==s.phase){coins.forEach(({disk,label},i)=>{const passed=i<s.step;disk.clear().circle(0,2,53).fill(passed?0xa77617:0x535064).stroke({color:passed?0xffd877:0x8b879e,width:5}).circle(0,0,42).fill(passed?0xe8aa28:0x7a768c).stroke({color:passed?0xffda75:0xb1acbf,width:3}).roundRect(-13,-31,26,5,3).fill({color:passed?0x81510d:0x575365,alpha:.8}).roundRect(-13,28,26,5,3).fill({color:passed?0x81510d:0x575365,alpha:.8});label.text=`${multiplierAt(i+1,s.difficulty).toFixed(2)}x`;});}
      if(previous>s.step&&s.step===0)position=142;lastStep=s.step;lastDifficulty=s.difficulty;lastPhase=s.phase;
    }
    camera.x=Math.max(0,Math.min(4300-view,position-view*.34));world.x=-camera.x*scale+(shake>0?(Math.random()-.5)*shake*8:0);shake*=.90;if(shake<.01)shake=0;
    const time=now/1000,elapsed=(now-phaseStart)/1000;const jumpProgress=Math.min(1,Math.max(0,(now-stepStart)/480));const jump=reduce.matches?0:Math.sin(jumpProgress*Math.PI)*45;const bob=reduce.matches?0:Math.sin(time*3)*3;shadow.x=position;shadow.y=342;chicken.x=position;chicken.y=342+bob-jump;chicken.rotation=s.phase==='lost'?.16:Math.sin(time*2)*.018;chicken.alpha=s.phase==='lost'?.68:1;
    impact.visible=s.phase==='lost'&&elapsed<1.5;if(impact.visible){impact.x=position;impact.y=Math.min(300,-100+elapsed*1050);}
    particles.clear();if((s.phase==='won'||s.phase==='lost')&&elapsed<1.8){for(let i=0;i<22;i++){const a=i*2.4,dist=elapsed*(55+(i%5)*19);particles.circle(position+Math.cos(a)*dist,280+Math.sin(a)*dist+elapsed*elapsed*25,i%3+2).fill({color:s.phase==='won'?0xffd667:0xbbb4c3,alpha:Math.max(0,1-elapsed/1.8)});}}
   });cleanup=()=>{tween?.kill();app.destroy(true,{children:true});};
  }start().catch(e=>{cleanup?.();cleanup=undefined;console.error('Pilot Chicken scene unavailable',e);});return()=>{disposed=true;cleanup?.();};
 },[]);
 return <div className="pc-scene-host" ref={host} aria-label="Piste de Pilot Chicken" role="img"/>;
}
