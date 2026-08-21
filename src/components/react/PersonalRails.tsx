import { useEffect, useState } from 'react';
import type { SearchDoc } from '../../lib/games.ts';
import { getRecent, relativeTime, subscribeRecent, type RecentEntry } from '../../lib/recent.ts';
import { getFavorites, subscribeFavorites } from '../../lib/favorites.ts';

interface Props {
  docs: SearchDoc[];
  which: 'recent' | 'favorites';
}

/**
 * The two personal rails. They render nothing until they have something to
 * show, so a first-time visitor sees a clean page rather than two empty
 * shelves apologising for being empty.
 */
export default function PersonalRails({ docs, which }: Props) {
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (which === 'recent') {
      setRecent(getRecent());
      return subscribeRecent(() => setRecent(getRecent()));
    }
    setFavs(getFavorites());
    return subscribeFavorites(() => setFavs(getFavorites()));
  }, [which]);

  if (!mounted) return null;

  const items =
    which === 'recent'
      ? recent
          .map((r) => ({ doc: docs.find((d) => d.slug === r.slug), entry: r }))
          .filter((x): x is { doc: SearchDoc; entry: RecentEntry } => Boolean(x.doc))
          .slice(0, 6)
      : favs
          .map((slug) => ({ doc: docs.find((d) => d.slug === slug), entry: null }))
          .filter((x): x is { doc: SearchDoc; entry: null } => Boolean(x.doc))
          .slice(0, 6);

  if (items.length === 0) return null;

  return (
    <section className="shell mt-14">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          {which === 'recent' ? 'Jump back in' : 'Your favourites'}
        </h2>
        {which === 'favorites' && (
          <a href="/favorites" className="shrink-0 text-sm font-medium text-text-dim hover:text-amber">
            See all →
          </a>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ doc, entry }) => (
          <li key={doc.slug}>
            <a
              href={`/games/${doc.slug}`}
              className="cabinet-glow group block overflow-hidden rounded-xl border border-edge bg-surface"
              style={{ ['--glow' as string]: doc.accent ?? 'var(--color-amber)' }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                <img src={doc.thumb} alt="" width="320" height="200" loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {entry && (
                  // Cyan appears here and only here: it marks live, resumable state.
                  <span className="tnum absolute right-1.5 bottom-1.5 rounded bg-ink/85 px-1.5 py-0.5 text-[10px] text-live backdrop-blur-sm">
                    {relativeTime(entry.lastPlayed)}
                  </span>
                )}
              </div>
              <p className="truncate px-2.5 py-2 text-xs font-semibold">{doc.title}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
