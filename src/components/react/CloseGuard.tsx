import { useEffect, useState } from 'react';
import { getPrefs, subscribePrefs } from '../../lib/prefs.ts';

/**
 * Opt-in "leave site?" browser prompt on tab close / navigation away.
 *
 * Off by default, like ambience in MusicPlayer — a surprise confirm dialog is
 * exactly the kind of thing this site tries not to do on a shared or managed
 * device. Toggled from Settings; renders nothing itself.
 */
export default function CloseGuard() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getPrefs().confirmOnClose);
    return subscribePrefs(() => setEnabled(getPrefs().confirmOnClose));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      // `returnValue` is the only part of this API Safari still honours; it's
      // deprecated in modern TS lib types, hence the indirection below.
      (ev as unknown as { returnValue: string }).returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);

  return null;
}
