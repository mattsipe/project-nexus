import { forwardRef } from 'react';
import type { LibraryDoc } from '../../lib/gameMeta.ts';
import { setStageHue } from '../../lib/stageHue.ts';
import FavoriteButton from './FavoriteButton.tsx';

interface Props {
  doc: LibraryDoc;
  /** capsule = 3:4 library grid. hero = 16:9 Continue row. */
  variant: 'capsule' | 'hero';
  priority?: boolean;
  /** Only for the Continue row — "15m ago", set by the caller from recent.ts. */
  playedBadge?: string;
  /** Playable games launch inline; the click never navigates. */
  onLaunch?: (doc: LibraryDoc, el: HTMLElement) => void;
}

/**
 * One game, one click. Playable games launch via a <button> that fills the
 * card — clicking it never navigates, Library mounts the player directly.
 * External games are a real <a target="_blank">, because that one genuinely
 * does need to leave the site.
 *
 * The favourite star and the (i) info link are siblings of that button, not
 * children of it — nesting a <button> (FavoriteButton) inside another
 * <button> is invalid HTML and browsers silently mangle it. The glow/lift
 * styling lives on this outer wrapper instead, triggered by :focus-within so
 * it still fires when the inner button is the thing that's actually focused.
 *
 * Hovering or focusing nudges the galaxy's nebula toward this game's accent
 * — the signature interaction the whole background exists to serve.
 */
const GameCapsule = forwardRef<HTMLButtonElement, Props>(function GameCapsule(
  { doc, variant, priority = false, playedBadge, onLaunch },
  ref,
) {
  const isHero = variant === 'hero';
  const cover = isHero ? doc.hero : doc.capsule;
  const playable = doc.src !== null;

  const art = (
    <div className={`relative overflow-hidden bg-ink ${isHero ? 'aspect-video' : 'aspect-[3/4]'}`}>
      <img
        src={cover}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 ease-[--ease-out-cabinet] group-hover:scale-[1.05]"
      />
      {!isHero && (
        <div className="scrim-b absolute inset-x-0 bottom-0 px-2.5 pt-8 pb-2">
          <p className="truncate font-display text-[13px] font-bold text-balance">{doc.title}</p>
        </div>
      )}
      {isHero && (
        <div className="scrim-b absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-4 pt-10 pb-3">
          <p className="truncate font-display text-base font-extrabold">{doc.title}</p>
          {playedBadge && (
            // Cyan appears here and only here: it marks live/resumable state.
            <span className="tnum shrink-0 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-live">
              {playedBadge}
            </span>
          )}
        </div>
      )}
      {!playable && (
        <span className="absolute top-2 right-2 rounded-md bg-ink/85 px-2 py-1 text-[10px] font-medium text-text-dim backdrop-blur-sm">
          Official site ↗
        </span>
      )}
    </div>
  );

  const style = { ['--glow' as string]: doc.accent };
  const onEnter = () => setStageHue(doc.accent);
  const onLeave = () => setStageHue(null);

  if (!playable) {
    return (
      <a
        href={doc.officialUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="cabinet-glow group relative block overflow-hidden rounded-[--radius-card] border border-edge bg-surface"
        style={style}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
      >
        {art}
      </a>
    );
  }

  // No launch handler: a plain link to the game's detail page rather than an
  // inline launch — used by contexts like "More like this", which browse
  // rather than launch.
  if (!onLaunch) {
    return (
      <a
        href={`/games/${doc.slug}`}
        className="cabinet-glow group relative block overflow-hidden rounded-[--radius-card] border border-edge bg-surface"
        style={style}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
      >
        {art}
      </a>
    );
  }

  return (
    <div
      className="cabinet-glow group relative overflow-hidden rounded-[--radius-card] border border-edge bg-surface"
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        ref={ref}
        type="button"
        className="block w-full text-left focus:outline-none"
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={(e) => onLaunch?.(doc, e.currentTarget)}
        data-capsule
      >
        {art}
      </button>
      <a
        href={`/games/${doc.slug}`}
        aria-label={`About ${doc.title}`}
        title="About"
        className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-text-dim opacity-0 backdrop-blur-sm transition-opacity hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.01" strokeLinecap="round" />
        </svg>
      </a>
      <FavoriteButton slug={doc.slug} title={doc.title} />
    </div>
  );
});

export default GameCapsule;
