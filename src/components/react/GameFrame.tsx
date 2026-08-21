import { useCallback, useEffect, useRef, useState } from 'react';
import { recordPlay } from '../../lib/recent.ts';
import { getPrefs, setPrefs } from '../../lib/prefs.ts';

interface Props {
  slug: string;
  title: string;
  src: string;
  /** Embedded third-party frames are sandboxed; our own games are not (see below). */
  sameOrigin: boolean;
  officialUrl: string | null;
  savesThirdParty: boolean;
}

export default function GameFrame({
  slug, title, src, sameOrigin, officialUrl, savesThirdParty,
}: Props) {
  const [launched, setLaunched] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number>(0);

  const launch = useCallback(() => {
    setLaunched(true);
    recordPlay(slug);
    // Music competes with the game's own audio, so step ours down while playing.
    const prefs = getPrefs();
    if (prefs.musicEnabled) setPrefs({ volume: Math.min(prefs.volume, 0.12) });
  }, [slug]);

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

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      // The frame owns the viewport once launched; Escape is handled by the browser
      // for fullscreen and by this bar's Back control otherwise.
    >
      <div
        className={`flex h-12 shrink-0 items-center gap-2 border-b border-edge bg-surface px-3 transition-transform duration-300 ${
          chromeVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setLaunched(false)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-dim transition-colors hover:bg-raised hover:text-text"
        >
          ← Back
        </button>
        <span className="truncate font-display text-sm font-extrabold">{title}</span>
        <span className="ml-auto flex items-center gap-1">
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
          not to Arcadia. Some browsers block that in an embedded frame — open the official site if
          your progress does not stick.
        </p>
      )}

      <div className="relative flex-1">
        {!loaded && (
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
    </div>
  );
}
