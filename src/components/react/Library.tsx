import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LibraryDoc } from '../../lib/gameMeta.ts';
import { CATEGORY_LABELS } from '../../lib/gameMeta.ts';
import type { Category } from '../../content.config.ts';
import { searchGames } from '../../lib/search.ts';
import { getFavorites, subscribeFavorites } from '../../lib/favorites.ts';
import { getRecent, relativeTime, subscribeRecent, recordPlay, type RecentEntry } from '../../lib/recent.ts';
import GameCapsule from './GameCapsule.tsx';
import GameFrame from './GameFrame.tsx';

interface Props {
  docs: LibraryDoc[];
  initialCategory?: Category;
  initialFavoritesOnly?: boolean;
}

type Filter = Category | 'all';

interface LaunchState {
  doc: LibraryDoc;
  originRect: DOMRect | null;
}

/**
 * The whole product surface: search, category chips, the "Continue" row, and
 * the portrait grid — all one component because they share one piece of
 * state (the active filter) and one piece of behaviour (clicking a capsule
 * launches in place, no navigation). Splitting header/grid/player into
 * separate islands would just mean threading the same state between them.
 */
export default function Library({ docs, initialCategory, initialFavoritesOnly }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Filter>(initialCategory ?? 'all');
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavoritesOnly ?? false);
  const [favSlugs, setFavSlugs] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [launch, setLaunch] = useState<LaunchState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const capsuleRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    setFavSlugs(getFavorites());
    setRecent(getRecent());
    const unsubFav = subscribeFavorites(() => setFavSlugs(getFavorites()));
    const unsubRecent = subscribeRecent(() => setRecent(getRecent()));
    return () => { unsubFav(); unsubRecent(); };
  }, []);

  // URL state: chip clicks push a history entry (so Back un-filters); typing
  // in search replaces in place, so it doesn't spam history one keystroke at
  // a time. readFromUrl runs on mount (to honour a shared/bookmarked link)
  // AND on popstate — without the latter, Back/Forward change the URL but
  // never touch React state, so the visible grid just doesn't move.
  const readFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    const q = params.get('q');
    const fav = params.get('fav');
    // Fall back to this page's own baseline (e.g. /category/puzzle's
    // initialCategory, /favorites' initialFavoritesOnly) rather than a
    // hardcoded 'all'/false — otherwise a path-based route's filter gets
    // wiped out the instant this runs on mount, since there is no matching
    // query param to read it back from.
    setCategory(c && (CATEGORY_LABELS as Record<string, string>)[c] ? (c as Category) : (initialCategory ?? 'all'));
    setQuery(q ?? '');
    setFavoritesOnly(fav === '1' ? true : fav === '0' ? false : (initialFavoritesOnly ?? false));
  }, [initialCategory, initialFavoritesOnly]);

  useEffect(() => {
    readFromUrl();
    window.addEventListener('popstate', readFromUrl);
    return () => window.removeEventListener('popstate', readFromUrl);
  }, [readFromUrl]);

  const syncUrl = useCallback((next: { category?: Filter; query?: string; fav?: boolean }, push: boolean) => {
    const params = new URLSearchParams(window.location.search);
    const c = next.category ?? category;
    const q = next.query ?? query;
    const fav = next.fav ?? favoritesOnly;
    c === 'all' ? params.delete('c') : params.set('c', c);
    q.trim() ? params.set('q', q) : params.delete('q');
    fav ? params.set('fav', '1') : params.delete('fav');
    const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    push ? window.history.pushState(null, '', url) : window.history.replaceState(null, '', url);
  }, [category, query, favoritesOnly]);

  const setCategoryAndSync = (next: Filter) => {
    setCategory(next);
    syncUrl({ category: next }, true);
  };
  const setFavoritesOnlyAndSync = (next: boolean) => {
    setFavoritesOnly(next);
    syncUrl({ fav: next }, true);
  };
  const setQueryAndSync = (next: string) => {
    setQuery(next);
    syncUrl({ query: next }, false);
  };

  // ⌘K / Ctrl-K / "/" focus the search box — there's no separate palette to
  // open, the box is always on screen, so the shortcut just gets you to it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    let list = docs;
    if (category !== 'all') list = list.filter((d) => d.categories.includes(category));
    if (favoritesOnly) list = list.filter((d) => favSlugs.includes(d.slug));
    if (query.trim()) list = searchGames(query, list, list.length).map((r) => r.doc);
    return list;
  }, [docs, category, favoritesOnly, favSlugs, query]);

  const continueDocs = useMemo(() => {
    if (query.trim()) return []; // an active search replaces the whole page with results
    return recent
      .map((r) => ({ entry: r, doc: docs.find((d) => d.slug === r.slug) }))
      .filter((x): x is { entry: RecentEntry; doc: LibraryDoc } => Boolean(x.doc))
      .slice(0, 6);
  }, [recent, docs, query]);

  const handleLaunch = useCallback((doc: LibraryDoc, el: HTMLElement) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setLaunch({ doc, originRect: reduced ? null : el.getBoundingClientRect() });
    recordPlay(doc.slug);
  }, []);

  // Arrow-key grid navigation, computed from actual layout rather than a
  // hardcoded column count — the column count changes at every breakpoint.
  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const buttons = capsuleRefs.current.filter((b): b is HTMLButtonElement => Boolean(b));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    e.preventDefault();

    const firstTop = buttons[0]?.getBoundingClientRect().top;
    let cols = buttons.length;
    for (let i = 1; i < buttons.length; i++) {
      if (buttons[i]!.getBoundingClientRect().top !== firstTop) { cols = i; break; }
    }

    let next = current;
    if (e.key === 'ArrowRight') next = Math.min(current + 1, buttons.length - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(current - 1, 0);
    else if (e.key === 'ArrowDown') next = Math.min(current + cols, buttons.length - 1);
    else if (e.key === 'ArrowUp') next = Math.max(current - cols, 0);
    buttons[next]?.focus();
  };

  const chips: Filter[] = ['all', ...Object.keys(CATEGORY_LABELS) as Category[]];
  const chipLabel = (c: Filter) => (c === 'all' ? 'All' : CATEGORY_LABELS[c]);

  return (
    <>
      <div className="sticky top-0 z-30 glass border-b border-edge">
        <div className="shell flex h-14 items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              strokeWidth="2.2" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-faint" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQueryAndSync(e.target.value)}
              type="search"
              placeholder="Search"
              aria-label="Search games"
              className="h-9 w-full rounded-lg border border-edge bg-surface/70 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-faint focus-visible:border-amber"
            />
          </div>

          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryAndSync(c)}
                aria-pressed={category === c}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  category === c
                    ? 'border-amber/50 bg-amber-wash text-amber'
                    : 'border-edge text-text-dim hover:border-edge-strong hover:text-text'
                }`}
              >
                {chipLabel(c)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFavoritesOnlyAndSync(!favoritesOnly)}
              aria-pressed={favoritesOnly}
              aria-label="Favourites only"
              title="Favourites only"
              className={`ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                favoritesOnly
                  ? 'border-amber/50 bg-amber-wash text-amber'
                  : 'border-edge text-text-dim hover:border-edge-strong hover:text-text'
              }`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill={favoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="shell py-5">
        {mounted && continueDocs.length > 0 && (
          <section id="continue" className="mb-7 scroll-mt-20">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wider text-text-faint uppercase">
              Continue
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {continueDocs.map(({ doc, entry }) => (
                <GameCapsule
                  key={doc.slug}
                  doc={doc}
                  variant="hero"
                  playedBadge={relativeTime(entry.lastPlayed)}
                  onLaunch={handleLaunch}
                />
              ))}
            </div>
          </section>
        )}

        {mounted && favoritesOnly && filtered.length === 0 ? (
          <EmptyState
            title="No favourites yet"
            body="Star a game from its capsule and it'll show up here."
            action={{ label: 'Clear filter', onClick: () => setFavoritesOnlyAndSync(false) }}
          />
        ) : mounted && query.trim() && filtered.length === 0 ? (
          <EmptyState title={`Nothing matches "${query}"`} body="Try a genre, like idle or puzzle." />
        ) : (
          <div
            ref={gridRef}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
          >
            {filtered.map((doc, i) => (
              <GameCapsule
                key={doc.slug}
                ref={(el) => { capsuleRefs.current[i] = el; }}
                doc={doc}
                variant="capsule"
                priority={i < 7}
                onLaunch={handleLaunch}
              />
            ))}
          </div>
        )}
      </div>

      {launch && (
        <GameFrame
          slug={launch.doc.slug}
          title={launch.doc.title}
          src={launch.doc.src!}
          sameOrigin={launch.doc.sameOrigin}
          officialUrl={launch.doc.officialUrl}
          savesThirdParty={launch.doc.savesThirdParty}
          coverSrc={launch.doc.capsule}
          originRect={launch.originRect}
          autoLaunch
          onBack={() => setLaunch(null)}
        />
      )}
    </>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl border border-dashed border-edge px-6 py-16 text-center">
      <p className="font-display text-lg font-extrabold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 rounded-xl bg-amber px-5 py-2.5 font-display text-sm font-extrabold text-ink"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
