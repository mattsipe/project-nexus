import { useEffect, useState } from 'react';
import { openSearch } from './searchBus.ts';

/**
 * The nav's search affordance. Separate from the palette itself so the palette
 * can live at the layout root and stay mounted while the nav re-renders.
 */
export default function SearchTrigger() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      onClick={openSearch}
      className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-text-dim transition-colors hover:border-edge-strong hover:text-text"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Search</span>
      <kbd className="tnum ml-1 hidden rounded border border-edge bg-ink px-1.5 py-0.5 text-[11px] text-text-faint sm:inline">
        {mac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
