/**
 * Every manifest entry must point at things that actually exist.
 *
 * Runs in CI and before deploy. Catches the two failure modes that would
 * otherwise reach production silently: a card whose cover art 404s, and a
 * self-hosted game whose bundle was never vendored.
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const GAMES_DIR = 'src/content/games';
const PUBLIC = 'public';

interface Problem { file: string; message: string }

const problems: Problem[] = [];
const notes: string[] = [];

// A bare custom-property token inside a Tailwind arbitrary value —
// `rounded-[--radius-card]` — compiles to an invalid declaration
// (`border-radius:--radius-card`) that browsers silently discard. The fix is
// always `[var(--token)]`. This exact bug has shipped twice (the rail width,
// then every capsule's corner radius and its launch easing), so it gets a
// permanent check rather than a third silent fix.
{
  const hits = execSync(
    String.raw`grep -rnE '\[--[a-z0-9-]+\]' src --include='*.tsx' --include='*.astro' --include='*.ts' || true`,
    { encoding: 'utf8' },
  ).trim();
  if (hits) {
    problems.push({
      file: 'src/**',
      message:
        `Bare custom-property token(s) in an arbitrary value — needs [var(--x)], not [--x]:\n` +
        hits.split('\n').map((l) => `        ${l}`).join('\n'),
    });
  }
}

function field(src: string, name: string): string | null {
  const m = src.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'));
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null;
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

const files = (await readdir(GAMES_DIR)).filter((f) => f.endsWith('.yaml'));
if (files.length === 0) problems.push({ file: GAMES_DIR, message: 'No game manifests found.' });

for (const file of files) {
  const src = await readFile(join(GAMES_DIR, file), 'utf8');
  const slug = file.replace(/\.yaml$/, '');

  // Every game needs both a capsule (3:4, the library grid) and a hero
  // (16:9, the Continue row) — checked the same way, so a small helper.
  for (const kind of ['capsule', 'hero'] as const) {
    const cover = field(src, kind);
    if (!cover) {
      problems.push({ file, message: `Missing \`cover.${kind}\`.` });
      continue;
    }
    if (!(await exists(join(PUBLIC, cover)))) {
      problems.push({ file, message: `Cover ${kind} not found: public${cover}` });
      continue;
    }
    if (cover.endsWith('.svg')) {
      // A malformed SVG renders as a broken-image icon with no console error
      // and no failed request, so nothing else in the pipeline would catch it.
      const problem = xmlProblem(await readFile(join(PUBLIC, cover), 'utf8'));
      if (problem) problems.push({ file, message: `Cover ${kind} ${problem}: public${cover}` });
    }
  }

  // Cover provenance gets the same audit-trail requirement as the game
  // itself: upstream-official art must name the licence and exact source.
  const coverSource = field(src, 'source');
  if (coverSource === 'upstream-official') {
    if (!field(src, 'license')) problems.push({ file, message: 'Cover claims upstream-official but has no `license`.' });
    if (!field(src, 'sourceUrl')) problems.push({ file, message: 'Cover claims upstream-official but has no `sourceUrl`.' });
  }

  const mode = field(src, 'mode');
  if (mode === 'selfhost') {
    const path = field(src, 'path');
    if (!path) {
      problems.push({ file, message: 'Self-hosted game has no `path`.' });
    } else {
      if (!(await exists(join(PUBLIC, path)))) {
        problems.push({ file, message: `Game bundle not found: public${path}` });
      }
      // A self-hosted game without its licence file beside it is a compliance
      // failure, not a cosmetic one.
      const dir = join(PUBLIC, path.split('/').slice(0, -1).join('/'));
      if (await exists(dir)) {
        const inDir = await readdir(dir);
        if (!inDir.some((f) => /^(LICENSE|LICENCE|COPYING)/i.test(f))) {
          problems.push({ file, message: `No LICENSE file shipped in ${dir}` });
        }
      }
    }
  }

  if (mode === 'embed' || mode === 'external') {
    if (!field(src, 'url')) problems.push({ file, message: `mode "${mode}" requires a \`url\`.` });
  }

  notes.push(`  ${mode?.padEnd(9) ?? '?'} ${slug}`);
}

/**
 * A minimal well-formedness scan, sufficient for the covers we generate.
 *
 * The failure we actually hit was an unescaped `<` inside text content, which
 * produces a document the browser refuses to render while reporting nothing.
 * A regex over tags cannot see that, because the stray `<` happily pairs with
 * the next `>`. So this walks the document and insists every `<` opens a tag
 * whose name starts sensibly, and every `&` opens a real entity.
 */
function xmlProblem(src: string): string | null {
  const doc = src.replace(/<!--[\s\S]*?-->/g, '');
  let inTag = false;
  let quote = '';

  for (let i = 0; i < doc.length; i++) {
    const c = doc[i]!;
    if (!inTag) {
      if (c === '<') {
        const next = doc[i + 1];
        if (!next || !/[A-Za-z_/!?]/.test(next)) {
          return `has an unescaped "<" at offset ${i} (use &lt;)`;
        }
        inTag = true;
      } else if (c === '&') {
        const entity = doc.slice(i, i + 12);
        if (!/^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/.test(entity)) {
          return `has an unescaped "&" at offset ${i} (use &amp;)`;
        }
      }
    } else if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      inTag = false;
    }
  }
  if (inTag) return 'has an unterminated tag';
  return null;
}

console.log(`\n  Checked ${files.length} game manifests\n`);
console.log(notes.join('\n'));

if (problems.length) {
  console.error(`\n  ✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`    ${p.file}: ${p.message}`);
  console.error('');
  process.exit(1);
}
console.log('\n  ✓ All assets present, all self-hosted games carry a licence.\n');
