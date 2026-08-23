import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { recordPlay } from '../../lib/recent.ts';
import { getPrefs, setPrefs } from '../../lib/prefs.ts';
import { setPlaying } from '../../lib/playerState.ts';
import type { PlayerConfig } from '../../lib/gameMeta.ts';

interface Props {
  slug: string;
  title: string;
  src: string;
  /** Embedded third-party frames are sandboxed; our own games are not (see below). */
  sameOrigin: boolean;
  officialUrl: string | null;
  savesThirdParty: boolean;
  /**
   * When set, the frame mounts already-launched instead of showing its own
   * Play button — used by the library grid, where clicking the capsule
   * itself IS the launch action. `originRect` (the clicked capsule's on-screen
   * rect) drives the grow-from-capsule animation; `coverSrc` is what
   * cross-fades into the loading iframe during that animation.
   */
  autoLaunch?: boolean;
  originRect?: DOMRect | null;
  coverSrc?: string;
  /**
   * The library owns the mount/unmount when autoLaunch is used, so Back
   * should tell it to unmount rather than collapsing back to a Play button
   * that would have nowhere sensible to render.
   */
  onBack?: () => void;
  /**
   * Per-game sizing from the manifest. Absent for games that already fill a
   * plain iframe correctly — see `fit()` above.
   */
  player?: PlayerConfig;
}

/** "16/9" -> 1.777…. Returns null for anything the schema would have rejected. */
function parseAspect(aspect: string): number | null {
  const [w, h] = aspect.split('/').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}

interface Geometry {
  /** CSS pixel size handed to the iframe itself. */
  width: number;
  height: number;
  /** Uniform scale applied on top, when the box can't fit those pixels 1:1. */
  scale: number;
}

/**
 * Fit one game into the player's content box.
 *
 * Three strategies, in priority order, all of which centre the result:
 *
 *  1. `nativeWidth`/`nativeHeight` — a legacy fixed-resolution game. Render at
 *     exactly its native size and scale the whole surface. The game never
 *     learns it isn't at 640x480, so its own layout maths stay valid, and it
 *     scales *up* on a 1920 display rather than sitting at 33% width.
 *  2. `aspect` — the game is responsive but only looks right at one ratio.
 *     Give it the largest correctly-shaped box that fits, then let it fill.
 *  3. `minWidth` alone — the game is fluid but collapses below some width.
 *     Render it at that width and scale down, which beats a 508px overflow.
 *
 * Returns null when no strategy applies, and the caller keeps the default
 * full-bleed iframe. That is the path every already-correct game takes.
 */
function fit(player: PlayerConfig | undefined, box: { w: number; h: number }): Geometry | null {
  if (!player || box.w <= 0 || box.h <= 0) return null;
  const { nativeWidth: nw, nativeHeight: nh, aspect, minWidth } = player;

  if (nw && nh) {
    return { width: nw, height: nh, scale: Math.min(box.w / nw, box.h / nh) };
  }

  const ratio = aspect ? parseAspect(aspect) : null;
  if (ratio) {
    let width = box.w;
    let height = width / ratio;
    if (height > box.h) {
      height = box.h;
      width = height * ratio;
    }
    // A ratio-correct box can still be too narrow for the game's own UI.
    if (minWidth && width < minWidth) {
      width = minWidth;
      height = width / ratio;
      return { width, height, scale: Math.min(box.w / width, box.h / height) };
    }
    return { width, height, scale: 1 };
  }

  if (minWidth && box.w < minWidth) {
    const scale = box.w / minWidth;
    // Height grows to match, so scaling down never crops the bottom off.
    return { width: minWidth, height: box.h / scale, scale };
  }

  return null;
}

export default function GameFrame({
  slug, title, src, sameOrigin, officialUrl, savesThirdParty,
  autoLaunch = false, originRect = null, coverSrc, onBack, player,
}: Props) {
  const [launched, setLaunched] = useState(autoLaunch);
  const [loaded, setLoaded] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [grown, setGrown] = useState(!originRect); // false only while the launch animation hasn't run yet
  const [showCoverFade, setShowCoverFade] = useState(Boolean(originRect && coverSrc));
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number>(0);
  // Only games that declare a `player` block need their box measured; for
  // everyone else the iframe is h-full w-full and this stays at zero, which
  // fit() reads as "no geometry".
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rotateDismissed, setRotateDismissed] = useState(false);

  const launch = useCallback(() => {
    setLaunched(true);
    recordPlay(slug);
    // Music competes with the game's own audio, so step ours down while playing.
    const prefs = getPrefs();
    if (prefs.musicEnabled) setPrefs({ volume: Math.min(prefs.volume, 0.12) });
  }, [slug]);

  // A game running should get every spare Chromebook cycle — the galaxy's
  // background animation pauses for as long as this component is mounted.
  useEffect(() => {
    if (!launched) return;
    setPlaying(true);
    return () => setPlaying(false);
  }, [launched]);

  // The capsule-to-fullscreen grow. Runs once, only when launched via the
  // library grid with a real origin rect, and only when motion is allowed —
  // reduced-motion is checked here rather than relying solely on the global
  // CSS override, so the shrunk starting transform is never applied at all.
  useLayoutEffect(() => {
    if (!launched || !originRect) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      setGrown(true);
      window.setTimeout(() => setShowCoverFade(false), 420);
    }));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide the chrome bar so the game gets the full frame, but bring it
  // straight back on any pointer or key activity.
  useEffect(() => {
    if (!launched) return;
    const wake = () => {
      setChromeVisible(true);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setChromeVisible(false), 2600);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, [launched]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // The stage's size drives the fit maths, and it changes on rotate, on
  // fullscreen, and when the save-persistence banner appears or hides — so it
  // is observed rather than measured once.
  useEffect(() => {
    if (!launched || !player) return;
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [launched, player]);

  // Fullscreen targets the wrapper, not the iframe, so our controls survive it.
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current?.requestFullscreen();
    } catch {
      // Some browsers refuse outside a user gesture chain; the game still plays.
    }
  }, []);

  const back = useCallback(() => {
    onBack ? onBack() : setLaunched(false);
  }, [onBack]);

  if (!launched) {
    return (
      <button
        type="button"
        onClick={launch}
        className="btn-primary group inline-flex items-center gap-2.5 rounded-xl px-6 py-3 font-display text-base font-extrabold text-ink"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        Play {title}
      </button>
    );
  }

  // The grow-from-capsule transform: while !grown, the wrapper sits scaled
  // and translated to exactly cover the capsule it was launched from; once
  // `grown` flips true (one frame after mount) the CSS transition below
  // carries it to identity — a capsule visibly becoming the fullscreen frame.
  let originStyle: CSSProperties | undefined;
  if (originRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = originRect.width / vw;
    const sy = originRect.height / vh;
    const tx = originRect.left + originRect.width / 2 - vw / 2;
    const ty = originRect.top + originRect.height / 2 - vh / 2;
    originStyle = {
      transform: grown ? 'translate(0, 0) scale(1, 1)' : `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
      transition: 'transform 420ms var(--ease-out-cabinet)',
    };
  }

  const geometry = fit(player, box);
  // Portrait phone, and a game that needs width. 640 keeps this off small
  // laptop windows, which are landscape and fine.
  const showRotateHint =
    player?.orientation === 'landscape' &&
    !rotateDismissed &&
    box.w > 0 &&
    box.w < box.h &&
    box.w < 640;

  // Rendered into <body> rather than in place. `main` establishes a stacking
  // context, which would otherwise trap this overlay beneath the sticky rail
  // no matter how high its z-index went.
  return createPortal(
    <div ref={wrapRef} data-player-wrapper data-grown={grown} className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-ink" style={originStyle}>
      {showCoverFade && coverSrc && (
        <img
          src={coverSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: grown ? 0 : 1 }}
        />
      )}

      <div
        className={`flex h-12 shrink-0 items-center gap-2 border-b border-edge bg-surface px-3 transition-transform duration-300 ${
          chromeVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          type="button"
          onClick={back}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-dim transition-colors hover:bg-raised hover:text-text"
        >
          ← Back
        </button>
        <span className="truncate font-display text-sm font-extrabold">{title}</span>
        <span className="ml-auto flex items-center gap-1">
          <a
            href={`/games/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-raised hover:text-text"
          >
            About
          </a>
          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-raised hover:text-text"
            >
              Official site ↗
            </a>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-raised hover:text-text"
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </span>
      </div>

      {savesThirdParty && chromeVisible && (
        <p className="shrink-0 bg-raised px-4 py-1.5 text-center text-xs text-text-dim">
          This game saves to {officialUrl ? new URL(officialUrl).hostname : 'the developer’s site'},
          not to this site. Some browsers block that in an embedded frame — open the official site if
          your progress does not stick.
        </p>
      )}

      {/* The stage is always ink, which is what removes the white gutters that
          bundles like belt-runner and hexgl paint around themselves. */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden bg-ink">
        {!loaded && !showCoverFade && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-sm text-text-dim">Loading {title}…</span>
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <iframe
            src={src}
            title={title}
            onLoad={() => setLoaded(true)}
            allow="fullscreen; autoplay; gamepad"
            // Self-hosted games run unsandboxed: they are on our own origin and
            // need localStorage for saves, and `allow-scripts allow-same-origin`
            // together would provide no sandboxing anyway. Third-party embeds are
            // sandboxed to everything they legitimately need and nothing more.
            {...(sameOrigin
              ? {}
              : { sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock' })}
            style={
              geometry
                ? {
                    width: `${geometry.width}px`,
                    height: `${geometry.height}px`,
                    // Scale from the centre of the already-centred box, so the
                    // game stays put whichever way the box is the tight one.
                    transform: geometry.scale === 1 ? undefined : `scale(${geometry.scale})`,
                  }
                : undefined
            }
            className={`border-0 transition-opacity duration-300 ${
              geometry ? 'shrink-0' : 'h-full w-full'
            } ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {showRotateHint && (
          // A hint, never a gate: the game is running underneath and playable.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
            <button
              type="button"
              onClick={() => setRotateDismissed(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-edge bg-surface/95 px-4 py-2 text-xs text-text-dim shadow-lg backdrop-blur-sm"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="7" width="18" height="10" rx="2" />
                <path d="M7 3.5A9 9 0 0 1 12 2" />
              </svg>
              Rotate your device for a bigger playfield
              <span className="text-text-faint">✕</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
