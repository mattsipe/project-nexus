/**
 * One-off pass to shrink the two heaviest cover images (both real screenshot
 * / promotional PNGs, not hand-drawn SVGs, hence the size — DEPLOY.md flagged
 * these at 280-395KB, well above what a ~235px grid card needs). Re-encodes
 * to WebP, which compresses photographic content far better than PNG at the
 * same visual quality. Kept as a script rather than a manual one-off shell
 * command so the transformation is reproducible if these assets are ever
 * refetched (scripts/fetch-upstream-art.ts).
 *
 * WebP is a drop-in here: content.config.ts's cover schema only requires the
 * path to start with /covers/, no extension constraint, and
 * scripts/verify-assets.ts only checks the file exists. The manifest's
 * `cover.capsule`/`cover.hero` paths are updated alongside the new files.
 *
 * Usage: node --experimental-strip-types scripts/optimize-covers.ts
 */
import sharp from 'sharp';
import { rm, stat } from 'node:fs/promises';

const TARGETS = [
  { slug: 'antimatter-dimensions', kind: 'capsule' as const },
  { slug: 'antimatter-dimensions', kind: 'hero' as const },
  { slug: 'bitburner', kind: 'capsule' as const },
  { slug: 'bitburner', kind: 'hero' as const },
];

async function main() {
  for (const { slug, kind } of TARGETS) {
    const src = `public/covers/${slug}-${kind}.png`;
    const dest = `public/covers/${slug}-${kind}.webp`;
    const before = (await stat(src)).size;
    await sharp(src).webp({ quality: 82 }).toFile(dest);
    const after = (await stat(dest)).size;
    console.log(`${src} -> ${dest}: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB`);
    await rm(src);

    const manifestPath = `src/content/games/${slug}.yaml`;
    const { readFile, writeFile } = await import('node:fs/promises');
    const yaml = await readFile(manifestPath, 'utf8');
    const updated = yaml.replace(
      new RegExp(`(${kind}:\\s*/covers/${slug}-${kind})\\.png`),
      '$1.webp',
    );
    if (updated === yaml) throw new Error(`${manifestPath}: no ${kind} path replaced`);
    await writeFile(manifestPath, updated);
  }
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
