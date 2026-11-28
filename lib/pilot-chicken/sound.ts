import { Howl, Howler } from 'howler';
let sounds: Record<string, Howl> | undefined;
export function sound(name:'step'|'coin'|'impact'|'cash'|'ambient', enabled:boolean){
 if(!enabled || typeof window==='undefined')return;
 if(!sounds) sounds=Object.fromEntries(['step','coin','impact','cash','ambient'].map(key=>[key,new Howl({src:[`/assets/pilot-chicken/sounds/${key}.wav`],volume:key==='ambient'?.12:key==='cash'?.5:.45,loop:key==='ambient'})]));
 if(name==='ambient'&&sounds.ambient.playing())return;sounds[name].play();
}
export function mute(value:boolean){Howler.mute(value);if(value) sounds?.ambient.stop();}
