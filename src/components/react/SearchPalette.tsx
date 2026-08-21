import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchDoc } from '../../lib/games.ts';
import { searchGames } from '../../lib/search.ts';
import { getRecent } from '../../lib/recent.ts';
import { onOpenSearch } from './searchBus.ts';

interface Props {
  docs: SearchDoc[];
}

export default function SearchPalette({ docs }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  useEffect(() => onOpenSearch(() => setOpen(true)), []);

  // Marks the document once the global shortcut is actually live. Tests wait on
  // this instead of guessing at hydration timing, and it costs one attribute.
  useEffect(() => {
    document.documentElement.dataset.searchReady = 'true';
    return () => {
      delete document.documentElement.dataset.searchReady;
    };
  }, []);

  // ⌘K / Ctrl-K from anywhere, and "/" when not already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setRecentSlugs(getRecent().map((r) => r.slug));
    // Defer so the element exists and the browser doesn't scroll the page.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = '';
    };
  }, [open]);

  /** With no query, the palette is a launcher for what you were already playing. */
  const results = useMemo(() => {
    if (query.trim()) return searchGames(query, docs, 8).map((r) => r.doc);
    const byRecent = recentSlugs
      .map((slug) => docs.find((d) => d.slug === slug))
      .filter((d): d is SearchDoc => Boolean(d));
    return [...byRecent, ...docs.filter((d) => !recentSlugs.includes(d.slug))].slice(0, 8);
  }, [query, docs, recentSlugs]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const go = (doc: SearchDoc | undefined) => {
    if (!doc) return;
    window.location.href =
      doc.mode === 'external' ? `/games/${doc.slug}` : `/games/${doc.slug}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/80 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search games"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-edge-strong bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-edge px-4">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
            strokeWidth="2.2" className="shrink-0 text-text-faint" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(results[cursor]);
              }
            }}
            placeholder="Search games…"
            aria-label="Search games"
            className="h-14 w-full bg-transparent text-base text-text outline-none placeholder:text-text-faint"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-dim">
            Nothing matches “{query}”. Try a genre, like <em>idle</em> or <em>puzzle</em>.
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {!query.trim() && recentSlugs.length > 0 && (
              <li className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-text-faint uppercase">
                Jump back in
              </li>
            )}
            {results.map((doc, i) => (
              <li key={doc.slug}>
                <a
                  href={`/games/${doc.slug}`}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
                    i === cursor ? 'bg-raised' : ''
                  }`}
                >
                  <img src={doc.thumb} alt="" width="64" height="40"
                    className="h-10 w-16 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{doc.title}</span>
                    <span className="block truncate text-xs text-text-dim">{doc.tagline}</span>
                  </span>
                  {i === cursor && (
                    <kbd className="tnum shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] text-text-faint">
                      ↵
                    </kbd>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
