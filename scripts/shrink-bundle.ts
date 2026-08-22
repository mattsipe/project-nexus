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
    // Both texture sets stay — the quality setting is the player's, and
    // dropping the high set would silently downgrade the default. Re-encoding
    // them costs nothing visible and is most of the bundle.
    drop: [
      'libs/Editor_files/', 'libs/Editor.html', 'libs/Three.r53.js',
      'replays/', 'cache.appcache', 'launch.coffee', 'manifest.webapp',
    ],
    webp: { under: ['textures/', 'textures.full/', 'css/'], quality: 82 },
    why: {
      'libs/Editor_files/': 'the level editor\'s own vendored dependencies; the editor is not shipped',
      'libs/Editor.html': 'the level editor, not reachable from the game',
      'libs/Three.r53.js': 'unused second copy of three.js — index.html loads Three.dev.js',
      'replays/': 'recorded ghost replays for a mode the standalone build does not expose',
      'cache.appcache': 'AppCache manifest — removed from every browser years ago, and it listed files by name',
      'launch.coffee': 'CoffeeScript source for launch.js, which ships compiled',
      'manifest.webapp': 'Firefox OS app manifest',
      'textures/': 'track, ship and HUD textures re-encoded from JPEG/PNG to WebP',
      'textures.full/': 'the high-quality texture set, same re-encode',
      'css/': 'menu and mobile-control artwork, same re-encode',
    },
  },
  'a-dark-room': {
    // The game runs in English by default and only fetches a translation
    // bundle when one is asked for. Shipping 27 of them triples the bundle.
    drop: [
      'lang/cs/', 'lang/de/', 'lang/el/', 'lang/eo/', 'lang/es/', 'lang/fr/',
      'lang/gl/', 'lang/id/', 'lang/it/', 'lang/ja/', 'lang/ko/', 'lang/lt_LT/',
      'lang/lv/', 'lang/nb/', 'lang/pl/', 'lang/pt/', 'lang/pt_br/', 'lang/ru/',
      'lang/sv/', 'lang/th/', 'lang/tr/', 'lang/uk/', 'lang/vi/', 'lang/zh_cn/',
      'lang/zh_tw/', 'lang/adarkroom.pot', 'lang/babel.cfg',
      'doc/', 'tools/', 'dev-server.js',
    ],
    why: {
      'lang/': 'translation bundles for languages Nexus does not offer; langs.js is trimmed to English to match',
      'doc/': 'design notes and spreadsheets from the upstream project',
      'tools/': 'upstream translation tooling',
      'dev-server.js': 'the upstream project\'s local dev server',
    },
  },
  'pocket-pool': {
    drop: ['assets/sounds/Bossa Antigua.mp3', 'assets/sounds/BallsCollide-old1.wav'],
    webp: { under: ['assets/sprites/'], quality: 82 },
    why: {
      'assets/sounds/Bossa Antigua.mp3': 'a Kevin MacLeod track under CC-BY, not covered by the repo\'s MIT licence and shipped with no attribution file — and the menu played it on load',
      'assets/sounds/BallsCollide-old1.wav': 'superseded duplicate of BallsCollide.wav, unreferenced',
      'assets/sprites/': 'table, menu and ball artwork re-encoded from PNG to WebP',
    },
  },
  racer: {
    drop: ['music/', 'Rakefile', 'v1.straight.html', 'v2.curves.html', 'v3.hills.html'],
    why: {
      'music/': 'the soundtrack, which the game starts on load — size, and Nexus does not autoplay audio',
      'Rakefile': 'upstream build task file',
      'v1.straight.html': 'tutorial stage of the upstream write-up, superseded by v4',
      'v2.curves.html': 'tutorial stage of the upstream write-up, superseded by v4',
      'v3.hills.html': 'tutorial stage of the upstream write-up, superseded by v4',
    },
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
      for (const u of under) {
        const n = hits.filter((f) => f.startsWith(u)).length;
        if (n) log.push(`Re-encoded ${n} images under ${u} to WebP — ${rule.why[u] ?? ''}`);
      }
      log.push(`WebP re-encode saved ${Math.round(saved / 1024)}KB in total.`);
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
