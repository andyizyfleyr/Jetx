// Sounds are synthesized locally; no audio files or network requests are needed.
let context: AudioContext | undefined;
export function playSound(kind: 'tick' | 'cash' | 'crash' | 'engine', enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime, osc = context.createOscillator(), gain = context.createGain();
    osc.type = kind === 'crash' ? 'sawtooth' : kind === 'engine' ? 'triangle' : 'sine';
    const frequency = kind === 'cash' ? 750 : kind === 'crash' ? 180 : kind === 'engine' ? 95 : 520;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'crash' ? 45 : frequency * 1.4, now + (kind === 'crash' ? .4 : .12));
    gain.gain.setValueAtTime(kind === 'engine' ? .012 : .045, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (kind === 'crash' ? .4 : .15));
    osc.connect(gain); gain.connect(context.destination); osc.start(now); osc.stop(now + (kind === 'crash' ? .4 : .16));
  } catch { /* Audio may be unavailable until a user gesture. */ }
}
