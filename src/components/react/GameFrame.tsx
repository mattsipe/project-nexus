import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { recordPlay } from '../../lib/recent.ts';
import { getPrefs, setPrefs } from '../../lib/prefs.ts';
import { setPlaying } from '../../lib/playerState.ts';

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
}

export default function GameFrame({
  slug, title, src, sameOrigin, officialUrl, savesThirdParty,
  autoLaunch = false, originRect = null, coverSrc, onBack,
}: Props) {
  const [launched, setLaunched] = useState(autoLaunch);
  const [loaded, setLoaded] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [grown, setGrown] = useState(!originRect); // false only while the launch animation hasn't run yet
  const [showCoverFade, setShowCoverFade] = useState(Boolean(originRect && coverSrc));
  const wrapRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number>(0);

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
        className="group inline-flex items-center gap-2.5 rounded-xl bg-amber px-6 py-3 font-display text-base font-extrabold text-ink transition-transform hover:scale-[1.02] active:scale-100"
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

      <div className="relative flex-1">
        {!loaded && !showCoverFade && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-sm text-text-dim">Loading {title}…</span>
          </div>
        )}
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
          className={`h-full w-full border-0 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    </div>,
    document.body,
  );
}
