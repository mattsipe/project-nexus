/**
 * Fetch real official cover art for games whose upstream licence permits
 * reuse — verified per-game below, recorded again (with the exact source URL
 * and date) in the game's own manifest, where the build enforces it.
 *
 * Unlike the self-hosted games (scripts/capture-covers.ts, a screenshot we
 * took ourselves) this pulls actual promotional/branding assets the
 * developers shipped in their own repositories. That's only legitimate
 * because those repositories' licences cover the assets too — MIT for
 * Antimatter Dimensions, Apache-2.0 for Bitburner's Steam asset set. An
 * embedded game whose repo licence does NOT cover its art (or has no public
 * repo at all) does not belong in this file; it gets original art instead.
 *
 * Usage: node --experimental-strip-types scripts/fetch-upstream-art.ts
 */
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CDN = 'https://cdn.jsdelivr.net/gh';
const TMP = '.tmp-art';
const OUT = 'public/covers';
const CAPSULE = { width: 600, height: 800 };
const HERO = { width: 1280, height: 720 };

function sips(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('sips', args, { stdio: 'ignore' });
    proc.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sips ${args.join(' ')} failed`))));
    proc.once('error', reject);
  });
}

async function fetchTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/** Crop to an exact WxH region centered in the source, per Steam's own capsule convention. */
async function cropCentered(src: string, dest: string, w: number, h: number): Promise<void> {
  await sips(['-c', String(h), String(w), src, '--out', dest]);
}

async function resizeExact(src: string, dest: string, w: number, h: number): Promise<void> {
  await sips(['-z', String(h), String(w), src, '--out', dest]);
}

async function main(): Promise<void> {
  await mkdir(TMP, { recursive: true });
  await mkdir(OUT, { recursive: true });

  // ── Antimatter Dimensions — MIT source repo, art included ──────────────
  {
    const src = join(TMP, 'ad-loading.png');
    await fetchTo(
      `${CDN}/IvarK/AntimatterDimensionsSourceCode@master/public/images/loading.png`,
      src,
    );
    // Already 3840×2160 (16:9) — the hero is just a downscale.
    await resizeExact(src, join(OUT, 'antimatter-dimensions-hero.png'), HERO.width, HERO.height);
    // Capsule: centered 3:4 crop at full source height, then downscale.
    const cropped = join(TMP, 'ad-capsule-crop.png');
    await cropCentered(src, cropped, 1620, 2160);
    await resizeExact(cropped, join(OUT, 'antimatter-dimensions-capsule.png'), CAPSULE.width, CAPSULE.height);
    console.log('  ✓ antimatter-dimensions');
  }

  // ── Bitburner — Apache-2.0 source repo, official Steam asset set ───────
  {
    const capsuleSrc = join(TMP, 'bb-library-capsule.png');
    await fetchTo(
      `${CDN}/bitburner-official/bitburner-src@master/assets/Steam/Library/Library_Capsule.png`,
      capsuleSrc,
    );
    // 600×900 native (Steam's own portrait spec) — crop to our 3:4 (600×800).
    await cropCentered(capsuleSrc, join(OUT, 'bitburner-capsule.png'), CAPSULE.width, CAPSULE.height);

    const heroSrc = join(TMP, 'bb-library-hero.png');
    await fetchTo(
      `${CDN}/bitburner-official/bitburner-src@master/assets/Steam/Library/Library_Hero.png`,
      heroSrc,
    );
    // 3840×1240 native — crop the width down to 16:9 at full height, then downscale.
    const cropped = join(TMP, 'bb-hero-crop.png');
    await cropCentered(heroSrc, cropped, 2204, 1240);
    await resizeExact(cropped, join(OUT, 'bitburner-hero.png'), HERO.width, HERO.height);
    console.log('  ✓ bitburner');
  }

  await rm(TMP, { recursive: true, force: true });
  console.log('\n  ✓ upstream art fetched to public/covers/\n');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
