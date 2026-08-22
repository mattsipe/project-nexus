import { useEffect, useState } from 'react';
import { isFavorite, toggleFavorite, subscribeFavorites } from '../../lib/favorites.ts';

interface Props {
  slug: string;
  title: string;
  /** The detail page wants a labelled button; cards want the bare star. */
  variant?: 'icon' | 'labelled';
}

export default function FavoriteButton({ slug, title, variant = 'icon' }: Props) {
  // Starts false on the server and on first paint, then corrects after mount.
  // Reading localStorage during render would desync hydration.
  const [fav, setFav] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFav(isFavorite(slug));
    setReady(true);
    return subscribeFavorites(() => setFav(isFavorite(slug)));
  }, [slug]);

  const label = fav ? `Remove ${title} from favourites` : `Add ${title} to favourites`;

  if (variant === 'labelled') {
    return (
      <button
        type="button"
        onClick={() => setFav(toggleFavorite(slug))}
        aria-pressed={fav}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
          fav
            ? 'border-emerald/50 bg-emerald-wash text-emerald'
            : 'border-edge bg-raised text-text-dim hover:border-edge-strong hover:text-text'
        }`}
      >
        <Star filled={fav} />
        {fav ? 'Favourited' : 'Add to favourites'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setFav(toggleFavorite(slug))}
      aria-label={label}
      aria-pressed={fav}
      title={label}
      className={`absolute top-2.5 left-2.5 grid h-8 w-8 place-items-center rounded-full border backdrop-blur-sm transition-all ${
        // Always visible once starred; otherwise it appears on hover or focus so
        // the card art stays clean. Touch devices get it permanently.
        fav
          ? 'border-emerald/40 bg-ink/85 text-emerald opacity-100'
          : 'border-white/10 bg-ink/70 text-text-dim opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
      } ${ready ? '' : 'invisible'} hover:border-emerald/40 hover:text-emerald`}
    >
      <Star filled={fav} />
    </button>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95z" />
    </svg>
  );
}
