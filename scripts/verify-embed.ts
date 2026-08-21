/**
 * Re-check that every embedded game still permits framing.
 *
 * A site can start sending X-Frame-Options at any time, which would turn a
 * working game into a blank rectangle. This runs on a schedule rather than in
 * the build: a third-party outage should not be able to fail our deploy.
 *
 * If a game starts blocking, the fix is to change its manifest to
 * `mode: external`. Never to work around the header.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GAMES_DIR = 'src/content/games';

function field(src: string, name: string): string | null {
  const m = src.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'));
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null;
}

interface Result { slug: string; url: string; ok: boolean; detail: string }

const results: Result[] = [];
const files = (await readdir(GAMES_DIR)).filter((f) => f.endsWith('.yaml'));

for (const file of files) {
  const src = await readFile(join(GAMES_DIR, file), 'utf8');
  if (field(src, 'mode') !== 'embed') continue;

  const slug = file.replace(/\.yaml$/, '');
  const url = field(src, 'url');
  if (!url) {
    results.push({ slug, url: '(none)', ok: false, detail: 'no url in manifest' });
    continue;
  }

  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const xfo = res.headers.get('x-frame-options');
    const csp = res.headers.get('content-security-policy');
    const ancestors = csp?.match(/frame-ancestors[^;]*/i)?.[0];

    if (!res.ok) results.push({ slug, url, ok: false, detail: `HTTP ${res.status}` });
    else if (xfo) results.push({ slug, url, ok: false, detail: `X-Frame-Options: ${xfo}` });
    else if (ancestors) results.push({ slug, url, ok: false, detail: ancestors });
    else results.push({ slug, url, ok: true, detail: 'no framing restriction' });
  } catch (err) {
    results.push({
      slug, url, ok: false,
      detail: `unreachable (${err instanceof Error ? err.message : String(err)})`,
    });
  }
}

console.log(`\n  Embed check — ${results.length} game(s)\n`);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.slug.padEnd(24)} ${r.detail}`);
}

const broken = results.filter((r) => !r.ok);
if (broken.length) {
  console.error(
    `\n  ${broken.length} embed(s) no longer framable. Switch them to mode: external.\n` +
    `  Do not attempt to bypass the restriction.\n`,
  );
  process.exit(1);
}
console.log('\n  ✓ All embedded games still permit framing.\n');
