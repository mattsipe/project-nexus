import { key, read, write, notify, subscribe } from './storage.ts';

export const PREFS_KEY = key('prefs');

export interface Prefs {
  /** Music is opt-in. See the note in MusicPlayer for why this is never true by default. */
  musicEnabled: boolean;
  /** 0–1. Persisted separately from `musicEnabled` so unmuting restores the old level. */
  volume: number;
  gridDensity: 'comfortable' | 'compact';
}

export const DEFAULT_PREFS: Prefs = {
  musicEnabled: false,
  volume: 0.35,
  gridDensity: 'comfortable',
};

const isPrefs = (v: unknown): v is Partial<Prefs> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function getPrefs(): Prefs {
  // Merged over defaults so a key added in a later release doesn't come back undefined.
  const stored = read<Partial<Prefs>>(PREFS_KEY, isPrefs, {});
  return {
    ...DEFAULT_PREFS,
    ...stored,
    volume: clamp01(stored.volume ?? DEFAULT_PREFS.volume),
  };
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  next.volume = clamp01(next.volume);
  write(PREFS_KEY, next);
  notify(PREFS_KEY);
  return next;
}

export const subscribePrefs = (fn: () => void) => subscribe(PREFS_KEY, fn);

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_PREFS.volume;
}
