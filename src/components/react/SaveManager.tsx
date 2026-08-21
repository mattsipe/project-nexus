import { useEffect, useRef, useState } from 'react';
import { ownKeys, foreignKeys, snapshot, restore, storageAvailable } from '../../lib/storage.ts';

interface Backup {
  format: 'arcadia-backup';
  version: 1;
  exportedAt: string;
  entries: Record<string, string>;
}

/**
 * Save backup and restore.
 *
 * This exists because the audience is largely on shared or managed devices
 * where the browser profile can be wiped without warning, and the catalogue is
 * full of games people play for hundreds of hours. A site that cannot hand
 * back your progress has not really earned it.
 *
 * The backup deliberately includes keys written by self-hosted games, not just
 * our own — those keys ARE the save files.
 */
export default function SaveManager() {
  const [available, setAvailable] = useState(true);
  const [counts, setCounts] = useState({ ours: 0, games: 0 });
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setCounts({ ours: ownKeys().length, games: foreignKeys().length });

  useEffect(() => {
    setAvailable(storageAvailable());
    refresh();
  }, []);

  const download = () => {
    const keys = [...ownKeys(), ...foreignKeys()];
    const backup: Backup = {
      format: 'arcadia-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: snapshot(keys),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcadia-saves-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${keys.length} entries to your downloads.`);
  };

  const upload = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        typeof parsed !== 'object' || parsed === null ||
        (parsed as Backup).format !== 'arcadia-backup' ||
        typeof (parsed as Backup).entries !== 'object'
      ) {
        setStatus('That file is not an Arcadia backup.');
        return;
      }
      const { written, failed } = restore((parsed as Backup).entries);
      refresh();
      setStatus(
        failed > 0
          ? `Restored ${written} entries; ${failed} could not be written (storage may be full).`
          : `Restored ${written} entries. Reload a game to pick up its save.`,
      );
    } catch {
      setStatus('That file could not be read.');
    }
  };

  return (
    <section className="shell mt-10 mb-6 max-w-2xl">
      {!available && (
        <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          This browser is blocking site storage, so favourites and game saves will not persist
          past this tab. Private or guest mode is the usual cause.
        </p>
      )}

      <div className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="font-display text-xl font-extrabold">Back up your saves</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          Downloads one file containing your favourites, your history, and the save data of
          every game hosted here. Keep it somewhere that outlives this device.
        </p>
        <dl className="mt-4 flex gap-8 text-sm">
          <div>
            <dt className="text-text-faint">Arcadia settings</dt>
            <dd className="tnum text-lg">{counts.ours}</dd>
          </div>
          <div>
            <dt className="text-text-faint">Game save entries</dt>
            <dd className="tnum text-lg">{counts.games}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={download}
            className="rounded-xl bg-amber px-5 py-2.5 font-display text-sm font-extrabold text-ink transition-transform hover:scale-[1.02]"
          >
            Download backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-edge bg-raised px-5 py-2.5 text-sm font-semibold text-text-dim transition-colors hover:border-edge-strong hover:text-text"
          >
            Restore from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
        </div>

        {status && (
          <p role="status" className="mt-4 text-sm text-live">
            {status}
          </p>
        )}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-text-faint">
        Restoring writes over entries with the same name. Games you play on the developer's own
        site are saved there, not here, so they are not included.
      </p>
    </section>
  );
}
