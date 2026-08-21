import { key, read, write, notify, subscribe } from './storage.ts';

export const FAVORITES_KEY = key('favorites');

const isSlugList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

export function getFavorites(): string[] {
  return read(FAVORITES_KEY, isSlugList, []);
}

export function isFavorite(slug: string): boolean {
  return getFavorites().includes(slug);
}

/** Returns the new state so callers can update optimistically. */
export function toggleFavorite(slug: string): boolean {
  const current = getFavorites();
  const has = current.includes(slug);
  // Newest first — the favorites rail reads as "most recently starred".
  const next = has ? current.filter((s) => s !== slug) : [slug, ...current];
  write(FAVORITES_KEY, next);
  notify(FAVORITES_KEY);
  return !has;
}

export const subscribeFavorites = (fn: () => void) => subscribe(FAVORITES_KEY, fn);
