import { useEffect, useState } from 'react';
import type { SearchDoc } from '../../lib/games.ts';
import { getFavorites, subscribeFavorites, toggleFavorite } from '../../lib/favorites.ts';

export default function FavoritesList({ docs }: { docs: SearchDoc[] }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSlugs(getFavorites());
    setMounted(true);
    return subscribeFavorites(() => setSlugs(getFavorites()));
  }, []);

  if (!mounted) return null;

  const games = slugs
    .map((s) => docs.find((d) => d.slug === s))
    .filter((d): d is SearchDoc => Boolean(d));

  // An empty state is an invitation to act, not an apology.
  if (games.length === 0) {
    return (
      <section className="shell mt-10">
        <div className="rounded-2xl border border-dashed border-edge px-6 py-14 text-center">
          <p className="font-display text-lg font-extrabold">No favourites yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
            Star a game from any card or game page and it will show up here, and at the top of
            the home page.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-amber px-5 py-2.5 font-display text-sm font-extrabold text-ink"
          >
            Browse the catalogue
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="shell mt-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {games.map((doc) => (
          <article
            key={doc.slug}
            className="cabinet-glow group relative overflow-hidden rounded-[--radius-card] border border-edge bg-surface"
            style={{ ['--glow' as string]: doc.accent ?? 'var(--color-amber)' }}
          >
            <a href={`/games/${doc.slug}`} className="block">
              <div className="aspect-[16/10] overflow-hidden bg-ink">
                <img src={doc.thumb} alt="" width="640" height="400" loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </div>
              <div className="p-4">
                <h2 className="font-display text-base font-extrabold">{doc.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-text-dim">{doc.tagline}</p>
              </div>
            </a>
            <button
              type="button"
              onClick={() => toggleFavorite(doc.slug)}
              aria-label={`Remove ${doc.title} from favourites`}
              className="absolute top-2.5 left-2.5 grid h-9 w-9 place-items-center rounded-lg bg-ink/80 text-amber backdrop-blur-sm hover:text-text"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z" />
              </svg>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
