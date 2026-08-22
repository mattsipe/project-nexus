/**
 * Shrink a vendored game bundle in public/play/<slug>/.
 *
 * Several games worth having ship 8-20MB of assets: high-resolution texture
 * sets they only load at max quality, uncompressed PNGs, translation files for
 * languages we don't offer, and soundtracks. Vendoring them verbatim would put
 * ~45MB into dist/ for the sake of four games, on a site whose whole point is
 * that it loads on a school Chromebook.
 *
 * This is scripts/optimize-covers.ts's pattern generalised: declarative rules,
 * reproducible if a bundle is ever re-vendored, and it prints a change log in
 * the shape NEXUS-MODIFICATIONS.txt wants — for GPL games that record is a
 * licence obligation (s5(a)), not a nicety.
 *
 * Rules per slug:
 *   drop: glob-ish prefixes/suffixes removed outright
 *   webp: image globs re-encoded to WebP *in place of* the original, with the
 *         referencing HTML/JS/CSS rewritten to match
 *
 * Usage:
 *   node --experimental-strip-types scripts/shrink-bundle.ts <slug> [--dry]
 */
import sharp from 'sharp';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

interface Rule {
  /** Paths (relative to the bundle root) removed entirely. Prefix match. */
  drop?: string[];
  /** Extensions re-encoded to WebP, restricted to these path prefixes. */
  webp?: { under: string[]; quality?: number };
  /** Why — copied verbatim into the printed change log. */
  why: Record<string, string>;
}

const RULES: Record<string, Rule> = {
  hexgl: {
    // HexGL ships two complete texture sets and picks between them with its
    // own quality setting; the "full" set is only reachable at max quality.
    // Editor_files is the level editor's own vendored copy of three.js.
    drop: ['textures.full/', 'libs/Editor_files/', 'replays/'],
    why: {
      'textures.full/': 'high-quality texture set; the game falls back to textures/ at normal quality',
      'libs/Editor_files/': 'level-editor dependency, not reachable from the game',
      'replays/': 'recorded ghost replays, not used by the standalone build',
    },
  },
  'a-dark-room': {
    drop: ['lang/'],
    why: { 'lang/': 'translation bundles for languages Nexus does not offer; the game defaults to English' },
  },
  'pocket-pool': {
    webp: { under: ['assets/'], quality: 82 },
    why: { 'assets/': 'PNG sprites and table art re-encoded to WebP' },
  },
  racer: {
    drop: ['music/'],
    why: { 'music/': 'soundtrack removed — size, and Nexus does not autoplay audio' },
  },
};

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else out.push(relative(base, p));
  }
  return out;
}

/** Licence and attribution files are never removed, whatever the rules say. */
const ALWAYS_KEEP = /^(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS|NEXUS-MODIFICATIONS)/i;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) {
    console.error('Usage: node --experimental-strip-types scripts/shrink-bundle.ts <slug> [--dry]');
    process.exit(1);
  }
  const rule = RULES[slug];
  if (!rule) {
    console.error(`No rule for "${slug}". Add one to RULES in this file.`);
    process.exit(1);
  }

  const root = join('public', 'play', slug);
  const files = await walk(root);
  const sizeOf = async (f: string) => (await stat(join(root, f))).size;
  const before = (await Promise.all(files.map(sizeOf))).reduce((a, b) => a + b, 0);

  const log: string[] = [];

  // ── drop ──────────────────────────────────────────────────────────────
  for (const prefix of rule.drop ?? []) {
    const hits = files.filter((f) => f.startsWith(prefix) && !ALWAYS_KEEP.test(f));
    if (!hits.length) {
      console.warn(`  ⚠ drop rule "${prefix}" matched nothing — has the bundle changed?`);
      continue;
    }
    const kb = Math.round((await Promise.all(hits.map(sizeOf))).reduce((a, b) => a + b, 0) / 1024);
    console.log(`  drop ${prefix} — ${hits.length} files, ${kb}KB`);
    log.push(`Removed ${prefix} (${hits.length} files, ${kb}KB) — ${rule.why[prefix] ?? ''}`);
    if (!dry) for (const f of hits) await rm(join(root, f));
  }

  // ── webp ──────────────────────────────────────────────────────────────
  if (rule.webp) {
    const { under, quality = 82 } = rule.webp;
    const hits = files.filter(
      (f) => under.some((u) => f.startsWith(u)) && /\.(png|jpe?g)$/i.test(f),
    );
    let saved = 0;
    const renames = new Map<string, string>();
    for (const f of hits) {
      const dest = f.replace(/\.(png|jpe?g)$/i, '.webp');
      const from = await sizeOf(f);
      if (!dry) {
        await sharp(join(root, f)).webp({ quality }).toFile(join(root, dest));
        await rm(join(root, f));
      }
      const to = dry ? from : (await stat(join(root, dest))).size;
      saved += from - to;
      renames.set(f, dest);
    }
    if (hits.length) {
      console.log(`  webp ${hits.length} images — saved ${Math.round(saved / 1024)}KB`);
      log.push(
        `Re-encoded ${hits.length} images under ${under.join(', ')} to WebP ` +
          `(${Math.round(saved / 1024)}KB saved) — ${Object.values(rule.why).join('; ')}`,
      );
      // Rewrite references. Bundles reference assets by relative path from a
      // handful of text files; rewriting all of them is cheaper and safer than
      // guessing which one owns each sprite.
      if (!dry) {
        const texts = (await walk(root)).filter((f) => /\.(html?|js|css|json)$/i.test(f));
        for (const t of texts) {
          const p = join(root, t);
          let src = await readFile(p, 'utf8');
          let touched = false;
          for (const [from, to] of renames) {
            for (const form of [from, from.split('/').pop()!]) {
              if (src.includes(form)) {
                src = src.split(form).join(form === from ? to : to.split('/').pop()!);
                touched = true;
              }
            }
          }
          if (touched) await writeFile(p, src);
        }
      }
    }
  }

  const after = dry
    ? before
    : (await Promise.all((await walk(root)).map(sizeOf))).reduce((a, b) => a + b, 0);

  console.log(
    `\n  ${slug}: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB` +
      (dry ? '  (dry run — nothing written)' : ''),
  );
  console.log('\n  --- for NEXUS-MODIFICATIONS.txt ---');
  for (const line of log) console.log(`  ${line}`);
  console.log();
}

main().catch((err: unknown) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
