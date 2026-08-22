/**
 * Capture real gameplay cover art for self-hosted / original games.
 *
 * We own the right to run these games (they're vendored under a
 * redistributable licence, or written by us), so a screenshot of them
 * running is ours to use — unlike the embedded games, where we have no
 * rights to their visual output at all and cover art has to come from
 * elsewhere (see scripts/fetch-upstream-art.ts) or be drawn from scratch.
 *
 * Drives a few real interactions first (a couple of merges, a few snake
 * moves) so the capture shows the game actually being played, not a blank
 * start screen — which is also closer to what a capsule needs to communicate.
 *
 * Usage: node --experimental-strip-types scripts/capture-covers.ts
 * Requires `public/` served on :4322 (the script starts and stops its own
 * static server via `python3 -m http.server`).
 */
import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const PORT = 4322;
const BASE = `http://localhost:${PORT}`;
const CAPSULE = { width: 600, height: 800 };
const HERO = { width: 1280, height: 720 };

interface Capture {
  slug: string;
  path: string;
  /** Called once per viewport (capsule, then hero unless padColor is set). */
  prepare: (page: import('@playwright/test').Page, kind: 'capsule' | 'hero') => Promise<void>;
  /**
   * Games with a portrait natural shape don't need a separate hero capture:
   * the capsule screenshot IS the art, just letterboxed out to 16:9 in this
   * background colour instead of cropped down to a sliver of a wide frame.
   */
  padColor?: string;
  /**
   * [height, width] to centre-crop to before the final resize — for games
   * whose own page chrome leaves the actual playfield a small island in a
   * lot of empty background at our capture viewport size. sips crops
   * centred on the source image, which is why this only works when the
   * board is already roughly centred in the viewport (true for both games
   * that currently use it).
   */
  cropCapsule?: [number, number];
  cropHero?: [number, number];
}

const CAPTURES: Capture[] = [
  {
    slug: '2048',
    path: '/play/2048/index.html',
    prepare: async (page) => {
      for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(120);
      }
    },
  },
  {
    slug: 'hextris',
    path: '/play/hextris/index.html',
    // The board sits centred with a lot of the page's own light chrome
    // (HUD, margins) around it — crop tight to the hex before the final
    // resize so the cover isn't mostly empty page.
    cropCapsule: [613, 460],
    // Derive the hero from the (already cropped) capsule rather than a
    // separate wide-viewport capture: at 1280x720 the board occasionally
    // rendered visibly sheared, reproducibly enough across runs that it
    // wasn't a one-off animation frame — something about the game's own
    // canvas transform at that viewport, not our capture logic. The capsule
    // viewport never showed it, so it's the safer source either way.
    padColor: 'ECF0F1',
    prepare: async (page) => {
      // Hextris's title screen is canvas-drawn, not real DOM — there is no
      // element to click. A tap/click anywhere on the canvas is what the game
      // itself listens for to start.
      await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
      // The tutorial overlay fades out over the game's first ~650 frames
      // (~11s) — wait it out so the capture shows real blocks, not text.
      await page.waitForTimeout(11500);
      // A slower, steadier cadence than a real fast player, so several
      // colours stack up around the hex before anything clears or the game
      // ends — the previous cadence here left the board almost bare.
      for (const key of [
        'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft',
        'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft',
      ]) {
        await page.keyboard.press(key);
        await page.waitForTimeout(1500);
      }
    },
  },
  {
    slug: 'neon-serpent',
    path: '/play/neon-serpent/index.html',
    prepare: async (page, kind) => {
      await page.getByRole('button', { name: 'Start' }).click();
      await page.waitForTimeout(300);
      // Neon Serpent is ours (original, MIT) — scripting a snake AI to
      // reliably survive long enough to earn a good score against a
      // randomly-placed pellet turned out to be the wrong amount of
      // engineering for a cover screenshot. game.js exposes a small
      // debug-only setter for exactly this (see its own comment); this
      // draws the SAME frame a real long game reaches, without depending on
      // one actually surviving that long in a scripted browser session.
      const rows = kind === 'hero' ? [9, 10, 11] : [9, 10];
      await page.evaluate((rows) => {
        const tailToHead: { x: number; y: number }[] = [];
        rows.forEach((y: number, i: number) => {
          const xs = [];
          for (let x = 4; x <= 16; x++) xs.push(x);
          if (i % 2 === 1) xs.reverse();
          for (const x of xs) tailToHead.push({ x, y });
        });
        const headFirst = tailToHead.slice().reverse();
        (window as unknown as { __neonSerpentDebug: { setForCapture: (c: unknown, s: number) => void } })
          .__neonSerpentDebug.setForCapture(headFirst, headFirst.length - 3);
      }, rows);
      await page.waitForTimeout(300);
    },
  },
];

function runSips(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('sips', args);
    proc.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sips ${args[0]} failed`))));
    proc.once('error', reject);
  });
}

async function startServer(): Promise<ChildProcess> {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'public'], {
    stdio: 'pipe',
  });
  // Poll for real readiness rather than guessing from a log line or a fixed
  // delay — both were flaky in practice.
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok || res.status === 404) return proc;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('static server never became reachable on :' + PORT);
}

async function main(): Promise<void> {
  await mkdir('public/covers', { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();

  try {
    for (const c of CAPTURES) {
      console.log(`  capturing ${c.slug}...`);

      // Capsule (3:4) — a taller, narrower viewport so the game itself fills
      // the frame instead of screenshotting a wide layout cropped down to a
      // sliver.
      const capsulePage = await browser.newPage({ viewport: CAPSULE });
      await capsulePage.goto(`${BASE}${c.path}`, { waitUntil: 'load', timeout: 15000 });
      await c.prepare(capsulePage, 'capsule');
      const capsulePath = `public/covers/${c.slug}-capsule.png`;
      await capsulePage.screenshot({ path: capsulePath });
      await capsulePage.close();
      if (c.cropCapsule) {
        await runSips(['-c', String(c.cropCapsule[0]), String(c.cropCapsule[1]), capsulePath]);
        await runSips(['-z', String(CAPSULE.height), String(CAPSULE.width), capsulePath]);
      }

      const heroPath = `public/covers/${c.slug}-hero.png`;
      if (c.padColor) {
        // Portrait game: derive the hero from the capsule capture instead of
        // a separate wide-viewport screenshot, which would render the board
        // tiny in a sea of empty background. Scale to fit the hero height,
        // then pad the width out with the game's own background colour.
        await runSips(['-z', String(HERO.height), String(Math.round(CAPSULE.width * (HERO.height / CAPSULE.height))),
          capsulePath, '--out', heroPath]);
        await runSips(['-p', String(HERO.height), String(HERO.width), '--padColor', c.padColor, heroPath]);
      } else {
        // Hero (16:9) — wide viewport, the game's natural landscape shape.
        const heroPage = await browser.newPage({ viewport: HERO });
        await heroPage.goto(`${BASE}${c.path}`, { waitUntil: 'load', timeout: 15000 });
        await c.prepare(heroPage, 'hero');
        await heroPage.screenshot({ path: heroPath });
        await heroPage.close();
        if (c.cropHero) {
          await runSips(['-c', String(c.cropHero[0]), String(c.cropHero[1]), heroPath]);
          await runSips(['-z', String(HERO.height), String(HERO.width), heroPath]);
        }
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n  ✓ ${CAPTURES.length} game(s) captured to public/covers/\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
