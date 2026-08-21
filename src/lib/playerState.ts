/**
 * Whether a game is currently running full-screen over the site.
 *
 * The galaxy's canvas loop pauses while this is true — a running game should
 * get every spare cycle on a Chromebook, not share them with our background
 * animation. GameFrame is the sole writer; Galaxy is the reader.
 */
let playing = false;
const listeners = new Set<(playing: boolean) => void>();

export function setPlaying(next: boolean): void {
  if (next === playing) return;
  playing = next;
  listeners.forEach((fn) => fn(playing));
}

export function isPlaying(): boolean {
  return playing;
}

export function subscribePlaying(fn: (playing: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
