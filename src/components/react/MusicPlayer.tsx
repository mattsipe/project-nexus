import { useEffect, useRef, useState } from 'react';
import { getPrefs, setPrefs, subscribePrefs } from '../../lib/prefs.ts';
import { startAmbience, type Ambience } from '../../lib/ambience.ts';

/**
 * Optional background ambience.
 *
 * Off by default and never autoplaying. That is a product decision, not a
 * browser-policy workaround: this site is built for people on school
 * Chromebooks, and audio starting by itself is the worst thing it could do to
 * them.
 *
 * The sound is synthesised rather than streamed (see lib/ambience.ts), so it
 * downloads nothing at all until — and after — you turn it on.
 */

export default function MusicPlayer() {
  const ambienceRef = useRef<Ambience | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [unavailable, setUnavailable] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const p = getPrefs();
    setEnabled(p.musicEnabled);
    setVolume(p.volume);
    setMounted(true);
    return subscribePrefs(() => {
      const next = getPrefs();
      setEnabled(next.musicEnabled);
      setVolume(next.volume);
    });
  }, []);

  // Start and stop the synth in response to the preference, and keep its level
  // in step with the slider without tearing it down and rebuilding it.
  useEffect(() => {
    if (enabled && !ambienceRef.current) {
      const amb = startAmbience(volume);
      if (!amb) {
        setUnavailable(true);
        return;
      }
      ambienceRef.current = amb;
    } else if (!enabled && ambienceRef.current) {
      ambienceRef.current.stop();
      ambienceRef.current = null;
    } else {
      ambienceRef.current?.setVolume(volume);
    }
  }, [enabled, volume]);

  // Stop the audio graph if the island is ever torn down.
  useEffect(() => () => ambienceRef.current?.stop(), []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setPrefs({ musicEnabled: next });
  };

  return (
    <div
      // z-[45]: above the rail (z-40) it now visually docks into on desktop —
      // the rail's own fixed nav spans the full column height, so anything
      // sharing that column at an equal-or-lower z-index gets its clicks
      // swallowed by the nav even where the nav renders nothing visible.
      className="fixed right-4 bottom-20 z-[45] flex items-center gap-2 md:right-auto md:bottom-[4.75rem] md:left-3 md:flex-row-reverse"
    >
      {/* Docked into the rail's own column on desktop (a fixed offset that
          centres the button in the rail's width, not a floating widget over
          the game grid) — md:flex-row-reverse puts the button at that anchor
          point and lets the volume popover extend to its right instead of
          overflowing off the left edge of the screen. Mobile keeps the
          original bottom-right placement, since there's no left rail there
          to dock into — the tab bar owns the bottom edge instead.
          Visible whenever ambience is on. It was briefly behind a
          disclosure, which meant that after a reload the only control was
          undiscoverable. */}
      {enabled && !unavailable && (
        <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface/95 px-3 py-2 backdrop-blur-md">
          <label htmlFor="music-volume" className="sr-only">Ambience volume</label>
          <input
            id="music-volume"
            type="range"
            min="0" max="1" step="0.05"
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              setPrefs({ volume: v });
            }}
            className="h-1 w-24 cursor-pointer accent-[var(--color-emerald)]"
          />
          <span className="tnum w-8 text-right text-[11px] text-text-faint">
            {Math.round(volume * 100)}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? 'Turn ambience off' : 'Turn ambience on'}
        title={unavailable ? 'Audio unavailable in this browser' : enabled ? 'Ambience on' : 'Ambience off'}
        // Matches the rail's own item tiles (h-11 w-11, rounded-lg,
        // text-only colour change) rather than the pill-with-wash treatment
        // used elsewhere, since this control docks visually into the rail's
        // own column on desktop. It still needs its own solid backing
        // (unlike the rail's tiles, which sit on the rail's shared chassis)
        // because on mobile it floats free above the bottom bar, over the
        // grid itself — solid, not blurred, for the same reason the rail is
        // solid chassis rather than glass.
        className={`grid h-11 w-11 place-items-center rounded-lg bg-raised transition-colors ${
          enabled && !unavailable ? 'text-emerald' : 'text-text-faint hover:text-text'
        }`}
      >
        {enabled && !unavailable ? <SpeakerOn /> : <SpeakerOff />}
      </button>

    </div>
  );
}

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
    </svg>
  );
}
function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4z" />
      <path d="M22 9l-6 6M16 9l6 6" />
    </svg>
  );
}
