/**
 * Generative background ambience, synthesised in the browser.
 *
 * Deliberately not an audio file. A loop would mean sourcing a CC0 track,
 * shipping a few hundred KB to devices on school wifi, auditing its licence,
 * and hearing the seam every 30 seconds. This is a few hundred bytes of code,
 * downloads nothing, never repeats, and raises no licensing question at all.
 *
 * The material: a low drone with a fifth above it, a slow filter sweep, and
 * occasional bell tones from a pentatonic set — chosen because a pentatonic
 * scale has no interval that can clash, so randomly-timed notes always sit
 * together. It is meant to be ignorable.
 */

const ROOT = 55;                               // A1
const BELLS = [440, 495, 587.33, 660, 880];    // A pentatonic, two octaves up

export interface Ambience {
  setVolume(v: number): void;
  stop(): void;
}

export function startAmbience(volume: number): Ambience | null {
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Ease in — audio that arrives at full level is startling.
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  filter.connect(master);

  // Drone: root, octave, and fifth, slightly detuned against each other so the
  // beating between them does the work a static chord cannot.
  const drones = [
    { freq: ROOT, detune: 0, gain: 0.5 },
    { freq: ROOT * 2, detune: 4, gain: 0.28 },
    { freq: ROOT * 3, detune: -5, gain: 0.16 },
  ].map(({ freq, detune, gain }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start();
    return osc;
  });

  // Slow filter movement, so the drone breathes rather than sits.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.045;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 210;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();

  let timer = 0;
  const scheduleBell = () => {
    // 7–19s apart: frequent enough to notice, rare enough not to become rhythm.
    timer = window.setTimeout(() => {
      bell(ctx, filter, BELLS[Math.floor(Math.random() * BELLS.length)]!);
      scheduleBell();
    }, 7000 + Math.random() * 12000);
  };
  scheduleBell();

  return {
    setVolume(v: number) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.15);
    },
    stop() {
      window.clearTimeout(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      window.setTimeout(() => {
        drones.forEach((o) => o.stop());
        lfo.stop();
        void ctx.close();
      }, 700);
    },
  };
}

function bell(ctx: AudioContext, dest: AudioNode, freq: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const g = ctx.createGain();
  g.gain.value = 0;
  // Fast attack, long decay: a struck sound, not a pad swell.
  g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 5.5);

  osc.connect(g).connect(dest);
  osc.start();
  osc.stop(ctx.currentTime + 6);
}
