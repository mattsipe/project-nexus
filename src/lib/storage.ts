/**
 * The single gateway to localStorage.
 *
 * Nothing else in the app touches `window.localStorage` directly. Two reasons:
 *
 *  1. Access can *throw*, not just return null — Chromebook guest sessions and
 *     Safari private mode raise SecurityError on the property access itself.
 *     Every path here is total: it degrades to in-memory and the UI still works.
 *  2. Self-hosted games write their own keys to this same origin. Namespacing
 *     everything of ours under `arcadia:` guarantees we never collide with a
 *     game's save data, and lets the backup feature find our keys precisely.
 */

const NS = 'arcadia';

/** In-memory fallback so a storage-denied browser still behaves for the session. */
const memory = new Map<string, string>();

let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const probe = `${NS}:__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function key(name: string, version = 1): string {
  return `${NS}:${name}:v${version}`;
}

function rawGet(k: string): string | null {
  if (!storageAvailable()) return memory.get(k) ?? null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return memory.get(k) ?? null;
  }
}

function rawSet(k: string, value: string): boolean {
  memory.set(k, value);
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(k, value);
    return true;
  } catch {
    // Almost always QuotaExceededError. We keep the in-memory copy so the
    // current session is coherent, and let the caller decide whether to warn.
    return false;
  }
}

/**
 * Read a JSON value, validating it before trusting it.
 *
 * `validate` is required rather than optional on purpose: stored data is
 * user-editable and survives across deploys, so a value written by an older
 * version of the app must never be able to crash a newer one.
 */
export function read<T>(k: string, validate: (v: unknown) => v is T, fallback: T): T {
  const raw = rawGet(k);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function write(k: string, value: unknown): boolean {
  try {
    return rawSet(k, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function remove(k: string): void {
  memory.delete(k);
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* nothing useful to do */
  }
}

/** Every key we own. Used by the backup/export feature. */
export function ownKeys(): string[] {
  if (!storageAvailable()) return [...memory.keys()];
  try {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(`${NS}:`)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Every key on this origin that is NOT ours — i.e. save data belonging to
 * self-hosted games. We never write or delete these; we only include them in
 * backups, because losing a 200-hour incremental save is the worst thing this
 * site could do to someone.
 */
export function foreignKeys(): string[] {
  if (!storageAvailable()) return [];
  try {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && !k.startsWith(`${NS}:`)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

export function snapshot(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = rawGet(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export function restore(entries: Record<string, string>): { written: number; failed: number } {
  let written = 0;
  let failed = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v !== 'string') { failed++; continue; }
    rawSet(k, v) ? written++ : failed++;
  }
  return { written, failed };
}

/** Cross-tab + same-tab change notification. Islands subscribe to stay in sync. */
const listeners = new Map<string, Set<() => void>>();

export function subscribe(k: string, fn: () => void): () => void {
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k)!.add(fn);

  const onStorage = (e: StorageEvent) => {
    if (e.key === k) fn();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.get(k)?.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** Call after any write so islands in the same tab update immediately. */
export function notify(k: string): void {
  listeners.get(k)?.forEach((fn) => fn());
}
