/**
 * Generate every brand-mark derivative from the supplied logo, in one place,
 * so the actual designed art drives the identity rather than a reconstruction.
 *
 * Phase 2 shipped a flat single-weight reconstruction of the mark on the
 * (correct, at the time) assumption that the real bevelled/gradient art
 * would turn to mush at rail/favicon sizes. Rendered from the source at
 * 20/26/32/48/64px, that assumption doesn't hold — the interlace stays
 * legible well below the 26px rail glyph size. So: no more reconstruction.
 * This script crops and resizes the ACTUAL supplied artwork instead.
 *
 * Source: assets/brand/nexus-mark-source.png (vendored copy of the supplied
 * ProjectNexusLogo.png — 1254x1254, transparent background, a six-fold
 * interlaced knot in the emerald/teal ramp).
 *
 * Usage: node --experimental-strip-types scripts/build-logo.ts
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'assets/brand/nexus-mark-source.png';
const OUT_DIR = 'public/brand';
const INK = '#060e0f';

// The rail glyph renders at 26px in CSS; ship 1x/2x/3x so it stays crisp on
// retina and 1.5x/2x display scaling (school-issue laptops vary a lot here).
const RAIL_SIZES = [26, 52, 78];

/** Scan the alpha channel directly for the mark's real bounding box.
 * sharp's own trim() compares against the top-left corner pixel, which for
 * this source (transparent corner, but the mark's own faint outer glow
 * fades gradually rather than hitting zero cleanly) trims nothing at the
 * default threshold. Reading the raw alpha bytes ourselves is a few lines
 * and doesn't depend on trim()'s edge-detection heuristic matching this
 * particular piece of art. */
async function alphaBBox(path: string): Promise<{ left: number; top: number; width: number; height: number }> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const THRESHOLD = 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3]!;
      if (a > THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`${path}: fully transparent, no bounding box found`);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const bbox = await alphaBBox(SRC);
  console.log(`alpha bbox: ${JSON.stringify(bbox)}`);

  // Pad to a square with a small margin so the interlace doesn't touch the
  // edge of its own canvas at small sizes.
  const side = Math.round(Math.max(bbox.width, bbox.height) * 1.06);
  const squareTransparent = () =>
    sharp(SRC)
      .extract(bbox)
      .resize({
        width: Math.round(side * 0.94),
        height: Math.round(side * 0.94),
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.round(side * 0.03),
        bottom: Math.round(side * 0.03),
        left: Math.round(side * 0.03),
        right: Math.round(side * 0.03),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

  // ── Rail glyph: transparent PNG + WebP at 1x/2x/3x. Sits directly on the
  //    rail's own ink background, so no backing fill needed. ──
  for (const size of RAIL_SIZES) {
    const buf = await squareTransparent().resize(size, size, { fit: 'contain' }).png().toBuffer();
    await sharp(buf).toFile(`${OUT_DIR}/mark-${size}.png`);
    await sharp(buf).webp({ quality: 92 }).toFile(`${OUT_DIR}/mark-${size}.webp`);
  }

  // ── Favicon: solid ink backing so it reads in a bright browser chrome,
  //    two sizes since it's PNG rather than a multi-res .ico. ──
  for (const size of [32, 64]) {
    await squareTransparent()
      .resize(Math.round(size * 0.82), Math.round(size * 0.82), { fit: 'contain' })
      .extend({
        top: Math.round(size * 0.09),
        bottom: Math.round(size * 0.09),
        left: Math.round(size * 0.09),
        right: Math.round(size * 0.09),
        background: INK,
      })
      .flatten({ background: INK })
      .png()
      .toFile(`public/favicon-${size}.png`);
  }

  // ── Apple touch icon: 180x180, same ink-backed treatment, slightly more
  //    generous inset since iOS applies its own corner mask on top. ──
  await squareTransparent()
    .resize(140, 140, { fit: 'contain' })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: INK })
    .flatten({ background: INK })
    .png()
    .toFile('public/apple-touch-icon.png');

  // ── og:image: 1200x630, mark centred on the ink ground. Kept modest in
  //    scale — this is a link-preview card, not a poster. ──
  const markForOg = await squareTransparent().resize(420, 420, { fit: 'contain' }).png().toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: INK },
  })
    .composite([{ input: markForOg, gravity: 'center' }])
    .png()
    .toFile('public/og-image.png');

  console.log('brand derivatives written to public/brand/, public/favicon-*.png, public/apple-touch-icon.png, public/og-image.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
