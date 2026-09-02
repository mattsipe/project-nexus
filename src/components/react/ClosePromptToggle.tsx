import { useEffect, useState } from 'react';
import { getPrefs, setPrefs, subscribePrefs } from '../../lib/prefs.ts';

/** Settings-page control for the CloseGuard prompt. */
export default function ClosePromptToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(getPrefs().confirmOnClose);
    setMounted(true);
    return subscribePrefs(() => setEnabled(getPrefs().confirmOnClose));
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setPrefs({ confirmOnClose: next });
  };

  return (
    <section className="shell mt-6 max-w-2xl">
      <div className="flex items-center justify-between gap-6 rounded-2xl border border-edge bg-surface p-6">
        <div>
          <h2 className="font-display text-xl font-extrabold">Confirm before closing</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            Ask before you close the tab or navigate away, so an accidental click doesn't cut a
            game short.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? 'Turn off confirm before closing' : 'Turn on confirm before closing'}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-emerald' : 'bg-raised'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-text transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
