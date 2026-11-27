// CC0 recordings are loaded locally; the countdown and flyaway are synthesized.
let context: AudioContext | undefined;
let master: GainNode | undefined;
let engine: { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | undefined;
let jetSample: AudioBuffer | undefined;
let cashSample: AudioBuffer | undefined;
let loadingSamples = false;
let noise: AudioBuffer | undefined;

/** Browsers require a user gesture before sound can play. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    context ||= new AudioContext();
    if (!master) { master = context.createGain(); master.gain.value = 0.75; master.connect(context.destination); }
    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (!loadingSamples && (!jetSample || !cashSample)) {
      loadingSamples = true;
      const ctx = context;
      const load = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Sound unavailable');
        return ctx.decodeAudioData(await response.arrayBuffer());
      };
      void Promise.allSettled([
        jetSample ? Promise.resolve() : load('/sounds/jet-loop.wav').then(buffer => { jetSample = buffer; }),
        cashSample ? Promise.resolve() : load('/sounds/cash-register.wav').then(buffer => { cashSample = buffer; }),
      ]).then(() => { loadingSamples = false; });
    }
  } catch { /* Audio is optional on unsupported devices. */ }
}

function noiseBuffer(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

export function stopEngine() {
  if (!engine || !context) return;
  const old = engine; engine = undefined;
  const now = context.currentTime;
  old.gain.gain.cancelScheduledValues(now);
  old.gain.gain.setTargetAtTime(0.0001, now, .06);
  try { old.source.stop(now + .35); } catch { /* already stopped */ }
}

/** A recorded jet loop, filtered for a lower, more powerful engine sound. */
export function updateEngine(enabled: boolean, multiplier: number) {
  if (!enabled || !context || !master || context.state !== 'running' || !jetSample) { stopEngine(); return; }
  try {
    const ctx = context, now = ctx.currentTime;
    if (!engine) {
      const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, now); gain.gain.setTargetAtTime(.9, now, .25); gain.connect(master);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2000; filter.connect(gain);
      const source = ctx.createBufferSource(); source.buffer = jetSample; source.loop = true; source.playbackRate.value = .9;
      source.connect(filter); source.start(now);
      engine = { source, gain, filter };
    }
    const intensity = Math.min(1, Math.log(Math.max(1, multiplier)) / Math.log(20));
    engine.source.playbackRate.cancelScheduledValues(now);
    engine.filter.frequency.cancelScheduledValues(now);
    engine.source.playbackRate.setTargetAtTime(.9 + intensity * .18, now, .2);
    engine.filter.frequency.setTargetAtTime(2000 + intensity * 800, now, .2);
  } catch { stopEngine(); }
}

export function playSound(kind: 'tick' | 'cash' | 'crash', enabled: boolean) {
  if (!enabled || !context || !master || context.state !== 'running') return;
  try {
    const ctx = context, output = master, now = ctx.currentTime;
    const note = (frequency: number, at: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain); gain.connect(output); osc.start(at); osc.stop(at + duration + .01);
    };
    if (kind === 'cash') {
      if (cashSample) {
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = cashSample; gain.gain.value = 2.5;
        source.connect(gain); gain.connect(output); source.start(now);
      } else {
        // Keep a short fallback if the recording is still loading or unavailable.
        [880, 1320, 1760].forEach((frequency, i) => note(frequency, now + i * .075, .32, .085));
      }
    } else if (kind === 'tick') {
      note(600, now, .09, .025);
    } else {
      // A rising then falling whistle plus a rush of air: fiiiiou!
      const whistle = ctx.createOscillator(), whistleGain = ctx.createGain();
      whistle.type = 'sine'; whistle.frequency.setValueAtTime(480, now);
      whistle.frequency.exponentialRampToValueAtTime(1450, now + .22);
      whistle.frequency.exponentialRampToValueAtTime(210, now + 1.05);
      whistleGain.gain.setValueAtTime(.0001, now); whistleGain.gain.exponentialRampToValueAtTime(.075, now + .08);
      whistleGain.gain.exponentialRampToValueAtTime(.0001, now + 1.05);
      whistle.connect(whistleGain); whistleGain.connect(output); whistle.start(now); whistle.stop(now + 1.06);
      const wind = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), windGain = ctx.createGain();
      wind.buffer = noiseBuffer(ctx); filter.type = 'bandpass'; filter.Q.value = .8;
      filter.frequency.setValueAtTime(550, now); filter.frequency.exponentialRampToValueAtTime(2300, now + .2); filter.frequency.exponentialRampToValueAtTime(320, now + 1);
      windGain.gain.setValueAtTime(.0001, now); windGain.gain.exponentialRampToValueAtTime(.12, now + .1); windGain.gain.exponentialRampToValueAtTime(.0001, now + 1);
      wind.connect(filter); filter.connect(windGain); windGain.connect(output); wind.start(now); wind.stop(now + 1.01);
    }
  } catch { /* Sound must never interrupt the game. */ }
}

export function setAudioEnabled(enabled: boolean) {
  if (master && context) master.gain.setTargetAtTime(enabled ? .75 : 0, context.currentTime, .015);
  if (!enabled) stopEngine();
}
