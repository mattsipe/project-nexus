/**
 * Vendor a self-hostable game from its upstream GitHub repo into public/play/.
 *
 * Fetches via jsDelivr rather than `git clone`. That is not a stylistic
 * preference: github.com and codeload.github.com are unreachable from the
 * network this project is developed on, while cdn.jsdelivr.net mirrors the same
 * repository contents and exposes a file-listing API. See docs/DECISIONS.md.
 *
 * Usage:
 *   npm run vendor -- <owner>/<repo>@<ref> <slug> [--subdir path] [--dry]
 *
 * Example:
 *   npm run vendor -- gabrielecirulli/2048@master 2048
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const LIST_API = 'https://data.jsdelivr.com/v1/packages/gh';
const CDN = 'https://cdn.jsdelivr.net/gh';

/** Never vendor repo scaffolding — it bloats the deploy and confuses nothing but us. */
const SKIP_PATTERNS = [
  /^\/\.git/,
  /^\/\.github\//,
  /^\/node_modules\//,
  /^\/\.vscode\//,
  /^\/(src|test|tests|spec)\//,
  /\.(md|yml|yaml|lock|log)$/i,
  /^\/(package|package-lock|bower|gruntfile|gulpfile|webpack\.config)/i,
  /^\/\.(gitignore|jshintrc|editorconfig|eslintrc|travis)/,
];

/** ...but licence and attribution files are mandatory, whatever the filters say. */
const ALWAYS_KEEP = /^\/(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS)/i;

interface JsDelivrFile {
  name: string;
  size: number;
}

async function listFiles(pkg: string): Promise<JsDelivrFile[]> {
  const res = await fetch(`${LIST_API}/${pkg}?structure=flat`);
  if (!res.ok) throw new Error(`jsDelivr listing failed for ${pkg}: ${res.status}`);
  const body = (await res.json()) as { files?: JsDelivrFile[] };
  if (!body.files?.length) throw new Error(`No files listed for ${pkg}`);
  return body.files;
}

function shouldKeep(name: string, subdir: string): boolean {
  if (subdir && !name.startsWith(subdir)) return false;
  if (ALWAYS_KEEP.test(name)) return true;
  return !SKIP_PATTERNS.some((re) => re.test(name));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const subdirIdx = args.indexOf('--subdir');
  const subdir = subdirIdx > -1 ? (args[subdirIdx + 1] ?? '') : '';
  const subdirValueIdx = subdirIdx > -1 ? subdirIdx + 1 : -1;
  const positional = args.filter((a, i) => !a.startsWith('--') && i !== subdirValueIdx);

  const [pkg, slug] = positional;
  if (!pkg || !slug) {
    console.error('Usage: npm run vendor -- <owner>/<repo>@<ref> <slug> [--subdir path] [--dry]');
    process.exit(1);
  }

  const dest = join('public', 'play', slug);
  console.log(`\n  ${pkg}  →  ${dest}${subdir ? `  (subdir ${subdir})` : ''}\n`);

  const files = await listFiles(pkg);
  const keep = files.filter((f) => shouldKeep(f.name, subdir));
  const bytes = keep.reduce((sum, f) => sum + f.size, 0);

  console.log(`  ${keep.length} of ${files.length} files · ${(bytes / 1024).toFixed(0)} KB`);
  if (!keep.some((f) => ALWAYS_KEEP.test(f.name))) {
    console.warn('  ⚠ No LICENSE file found upstream. Do not self-host without one.');
  }
  if (dry) {
    keep.slice(0, 40).forEach((f) => console.log(`    ${f.name}`));
    if (keep.length > 40) console.log(`    … +${keep.length - 40} more`);
    return;
  }

  let done = 0;
  // Modest concurrency: jsDelivr is generous but this runs on school-grade wifi.
  const queue = [...keep];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const file = queue.pop();
      if (!file) break;
      const res = await fetch(`${CDN}/${pkg}${file.name}`);
      if (!res.ok) {
        console.warn(`  ✗ ${file.name} (${res.status})`);
        continue;
      }
      const rel = subdir ? file.name.slice(subdir.length) : file.name;
      const out = join(dest, rel);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, Buffer.from(await res.arrayBuffer()));
      done++;
    }
  });
  await Promise.all(workers);

  console.log(`\n  ✓ ${done} files written to ${dest}\n`);
}

main().catch((err: unknown) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
