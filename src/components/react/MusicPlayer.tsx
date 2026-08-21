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
    <div className="fixed right-4 bottom-20 z-30 flex items-center gap-2 md:bottom-4">
      {/* Visible whenever ambience is on. It was briefly behind a disclosure,
          which meant that after a reload the only control was undiscoverable. */}
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
            className="h-1 w-24 cursor-pointer accent-[var(--color-amber)]"
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
        className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
          enabled && !unavailable
            ? 'border-amber/50 bg-amber-wash text-amber'
            : 'border-edge bg-surface/95 text-text-dim backdrop-blur-md hover:text-text'
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
