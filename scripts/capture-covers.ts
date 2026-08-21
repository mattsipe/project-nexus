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
  prepare: (page: import('@playwright/test').Page) => Promise<void>;
  /**
   * Games with a portrait natural shape don't need a separate hero capture:
   * the capsule screenshot IS the art, just letterboxed out to 16:9 in this
   * background colour instead of cropped down to a sliver of a wide frame.
   */
  padColor?: string;
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
    padColor: 'ECF0F1',
    prepare: async (page) => {
      // Hextris's title screen is canvas-drawn, not real DOM — there is no
      // element to click. A tap/click anywhere on the canvas is what the game
      // itself listens for to start.
      await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
      // The tutorial overlay fades out over the game's first ~650 frames
      // (~11s) — wait it out so the capture shows real blocks, not text.
      await page.waitForTimeout(11500);
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowLeft']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(500);
      }
    },
  },
  {
    slug: 'neon-serpent',
    path: '/play/neon-serpent/index.html',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Start' }).click();
      for (const key of [
        'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowRight',
        'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft',
      ]) {
        await page.keyboard.press(key);
        await page.waitForTimeout(220);
      }
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
      await c.prepare(capsulePage);
      await capsulePage.screenshot({ path: `public/covers/${c.slug}-capsule.png` });
      await capsulePage.close();

      if (c.padColor) {
        // Portrait game: derive the hero from the capsule capture instead of
        // a separate wide-viewport screenshot, which would render the board
        // tiny in a sea of empty background. Scale to fit the hero height,
        // then pad the width out with the game's own background colour.
        await runSips(['-z', String(HERO.height), String(Math.round(CAPSULE.width * (HERO.height / CAPSULE.height))),
          `public/covers/${c.slug}-capsule.png`, '--out', `public/covers/${c.slug}-hero.png`]);
        await runSips(['-p', String(HERO.height), String(HERO.width),
          '--padColor', c.padColor, `public/covers/${c.slug}-hero.png`]);
      } else {
        // Hero (16:9) — wide viewport, the game's natural landscape shape.
        const heroPage = await browser.newPage({ viewport: HERO });
        await heroPage.goto(`${BASE}${c.path}`, { waitUntil: 'load', timeout: 15000 });
        await c.prepare(heroPage);
        await heroPage.screenshot({ path: `public/covers/${c.slug}-hero.png` });
        await heroPage.close();
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
