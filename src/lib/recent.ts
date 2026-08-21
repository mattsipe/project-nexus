import { key, read, write, notify, subscribe } from './storage.ts';

export const RECENT_KEY = key('recent');

/** Capped so the rail stays meaningful and the payload stays small. */
const MAX_RECENT = 24;

export interface RecentEntry {
  slug: string;
  lastPlayed: number;
  playCount: number;
}

const isRecentList = (v: unknown): v is RecentEntry[] =>
  Array.isArray(v) &&
  v.every(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as RecentEntry).slug === 'string' &&
      typeof (e as RecentEntry).lastPlayed === 'number' &&
      typeof (e as RecentEntry).playCount === 'number',
  );

export function getRecent(): RecentEntry[] {
  return read(RECENT_KEY, isRecentList, []).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

/** Called when a game is actually launched, not merely viewed. */
export function recordPlay(slug: string, now = Date.now()): void {
  const current = read(RECENT_KEY, isRecentList, []);
  const existing = current.find((e) => e.slug === slug);
  const next: RecentEntry[] = [
    { slug, lastPlayed: now, playCount: (existing?.playCount ?? 0) + 1 },
    ...current.filter((e) => e.slug !== slug),
  ].slice(0, MAX_RECENT);

  write(RECENT_KEY, next);
  notify(RECENT_KEY);
}

export function clearRecent(): void {
  write(RECENT_KEY, []);
  notify(RECENT_KEY);
}

export const subscribeRecent = (fn: () => void) => subscribe(RECENT_KEY, fn);

/** "3 minutes ago" / "yesterday" — compact enough for a card corner. */
export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}
