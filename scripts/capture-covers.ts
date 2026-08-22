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
  /**
   * The mirror image of `padColor`, for games that only look right in
   * landscape. Engines that scale to fit width (melonJS, say) fill a portrait
   * viewport by extending their background downward, so the capsule capture
   * comes back as a strip of game over a lot of flat sky. Capture the hero
   * instead and take the capsule out of its middle third.
   */
  capsuleFromHero?: boolean;
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
  {
    slug: 'space-huggers',
    path: '/play/space-huggers/index.html',
    // The title card is drawn on a timer inside the level, not on a separate
    // screen (app.js fades 'SPACE HUGGERS' out around the ten-second mark), so
    // the only way past it is to play through it. A/D to run, W to jump, mouse
    // to aim and fire.
    prepare: async (page) => {
      const vp = page.viewportSize()!;
      for (const [key, dur] of [['KeyD', 1600], ['KeyA', 900], ['KeyD', 2000], ['KeyD', 1500]] as const) {
        await page.keyboard.down(key);
        await page.keyboard.press('KeyW');
        await page.mouse.move(vp.width * 0.75, vp.height * 0.5);
        await page.mouse.down();
        await page.waitForTimeout(dur);
        await page.mouse.up();
        await page.keyboard.up(key);
      }
      // Sit out the rest of the title timer before the shutter.
      await page.waitForTimeout(6000);
      await page.keyboard.down('KeyD');
      await page.mouse.down();
      await page.waitForTimeout(900);
      await page.mouse.up();
      await page.keyboard.up('KeyD');
    },
  },
  {
    slug: 'radius-raid',
    path: '/play/radius-raid/index.html',
    // The arena is a fixed 800x600 box centred in a much wider viewport, so
    // the raw hero shot is mostly black margin. Crop to 16:9 inside the arena.
    cropHero: [450, 800],
    // Radius Raid opens on a menu; PLAY starts a wave immediately, and a few
    // seconds of drifting fire gives the capture enemies and particles rather
    // than an empty arena.
    prepare: async (page) => {
      // The menu is canvas-drawn, so there is nothing to select — PLAY sits
      // at two thirds of the viewport height at both capture sizes.
      // ...and its buttons fire on `$.mouse.down` being true during an update
      // tick, not on a click event, so a normal click() is over before the
      // game ever samples it. Hold the button down across a few frames.
      const vp = page.viewportSize()!;
      await page.mouse.move(vp.width * 0.5, vp.height * 0.665);
      await page.waitForTimeout(200);
      await page.mouse.down();
      await page.waitForTimeout(250);
      await page.mouse.up();
      // Level 1 opens nearly empty. Play it for a while — WASD to move,
      // arrows to fire — so the capture has enemies, bullets and trails in
      // it rather than one ship alone on a grid.
      await page.waitForTimeout(2000);
      await page.keyboard.down('ArrowRight');
      for (const [move, dur] of [['KeyD', 1400], ['KeyS', 1200], ['KeyA', 1400], ['KeyW', 1200], ['KeyD', 1000]] as const) {
        await page.keyboard.down(move);
        await page.waitForTimeout(dur);
        await page.keyboard.up(move);
      }
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(900);
      await page.keyboard.up('ArrowUp');
    },
  },
  {
    slug: 'star-battle',
    path: '/play/star-battle/index.html',
    prepare: async (page) => {
      // The button holds both a "Start game" and a "Loading…" label, so its
      // accessible name is the two concatenated — target the id instead.
      await page.locator('#start-btn').click();
      // Assets load behind the button; the HUD and first wave need a moment.
      // Wait for the play scene, then take the shot early. A scripted pilot
      // survives about five seconds here before something rams it and the
      // score panel replaces the game — so the window is short by design.
      await page.locator('#play').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1400);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(230);
      }
    },
  },
  {
    slug: 'astray',
    path: '/play/astray/index.html',
    // A 3D maze seen from directly above is mostly floor. Rolling into the
    // first corridor puts the ball against lit brickwork, which is the thing
    // worth showing.
    prepare: async (page) => {
      await page.waitForTimeout(2000);
      for (const key of ['ArrowUp', 'ArrowRight', 'ArrowUp']) {
        await page.keyboard.down(key);
        await page.waitForTimeout(600);
        await page.keyboard.up(key);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(500);
    },
  },
  {
    slug: 'clumsy-bird',
    path: '/play/clumsy-bird/index.html',
    // Enter leaves the title screen; a few taps put the bird mid-flight
    // between pipes instead of on the ground at the start of a run.
    prepare: async (page) => {
      await page.waitForTimeout(1800);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      // Flap on a rhythm that roughly holds altitude. Too few taps and the
      // bird is on the ground; too many and it climbs into the top pipe and
      // the shutter catches the death fade, which is a white screen.
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(340);
      }
    },
  },
  {
    slug: 'belt-runner',
    path: '/play/belt-runner/index.html',
    // Vector line art on white — the game's own look. The playfield is a
    // fixed 780x540 box, so both captures crop into it rather than keeping
    // the page's white margin.
    cropCapsule: [532, 399],
    cropHero: [438, 778],
    prepare: async (page) => {
      await page.waitForTimeout(1200);
      // One press leaves 'waiting'. After that the ship has a single life, so
      // firing into the field and then flying through it ends the run and
      // puts the start prompt back on screen — turn and shoot, don't charge.
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
      for (let i = 0; i < 6; i++) {
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(120);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.press('Space');
        await page.waitForTimeout(260);
      }
      await page.waitForTimeout(400);
    },
  },
  {
    slug: 'hexgl',
    path: '/play/hexgl/index.html',
    prepare: async (page) => {
      await page.locator('#start').click();
      // step-2 is a "click to continue" gate, step-3 is the asset loader.
      await page.locator('#step-2').waitFor({ state: 'visible', timeout: 15000 });
      await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
      await page.locator('#step-4').waitFor({ state: 'visible', timeout: 60000 });
      // Hold the throttle so the shot has speed blur, a lit track and a HUD
      // reading something other than zero.
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(6000);
      await page.keyboard.up('ArrowUp');
      await page.waitForTimeout(200);
    },
  },
  {
    slug: 'a-dark-room',
    path: '/play/a-dark-room/index.html',
    // Every button here wraps a nested cooldown bar and a cost tooltip, so its
    // label is never the element's whole text content and getByText misses it
    // entirely. Locate by id.
    prepare: async (page) => {
      // The game opens by asking whether it may make noise — decline, so the
      // capture shows the game and not its consent dialog. It only asks on
      // some loads, hence the catch.
      await page.waitForTimeout(2000);
      await page.getByText('disable audio', { exact: true })
        .click({ timeout: 3000 }).catch(() => {});
      // The game's own dark theme: how most people play it, and the only
      // version of this page that belongs in a Nexus capsule.
      await page.locator('.lightsOff').first().click({ timeout: 5000 }).catch(() => {});
      await page.locator('#lightButton').click({ timeout: 15000 });
      // Stoking and gathering is what turns a bare page into a room with a
      // stores panel, a builder, and a growing column of choices.
      for (let i = 0; i < 10; i++) {
        for (const id of ['#stokeButton', '#gatherButton']) {
          await page.locator(id).click({ timeout: 1200 }).catch(() => {});
        }
        await page.waitForTimeout(600);
      }
      await page.waitForTimeout(600);
    },
  },
  {
    slug: 'pocket-pool',
    path: '/play/pocket-pool/index.html',
    prepare: async (page) => {
      const vp = page.viewportSize()!;
      await page.waitForTimeout(2500);
      // Canvas-drawn menu: "PLAYER vs COM." then a difficulty, both on the
      // left third of the frame.
      await page.mouse.click(vp.width * 0.29, vp.height * 0.55);
      await page.waitForTimeout(1200);
      await page.mouse.click(vp.width * 0.29, vp.height * 0.4);
      await page.waitForTimeout(2000);
      // Break, so the capture is a spread table rather than a rack.
      await page.mouse.move(vp.width * 0.5, vp.height * 0.5);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await page.waitForTimeout(2500);
    },
  },
  {
    slug: 'racer',
    path: '/play/racer/index.html',
    prepare: async (page) => {
      // The keys hint belongs on the page, not on the cover.
      await page.addStyleTag({ content: '#instructions { display: none; }' });
      await page.waitForTimeout(2500);
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(5000);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(900);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(600);
      await page.keyboard.up('ArrowUp');
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

  // Named slugs only, when given. Re-running the whole list would rewrite
  // covers that are already good with a differently-seeded run of the same
  // game, which is noise in a diff and occasionally a worse screenshot.
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = only.length ? CAPTURES.filter((c) => only.includes(c.slug)) : CAPTURES;
  if (only.length && todo.length !== only.length) {
    throw new Error(`No CAPTURES entry for: ${only.filter((s) => !CAPTURES.some((c) => c.slug === s)).join(', ')}`);
  }

  try {
    for (const c of todo) {
      console.log(`  capturing ${c.slug}...`);

      const capsulePath = `public/covers/${c.slug}-capsule.png`;
      const heroPath = `public/covers/${c.slug}-hero.png`;

      if (!c.capsuleFromHero) {
        // Capsule (3:4) — a taller, narrower viewport so the game itself fills
        // the frame instead of screenshotting a wide layout cropped down to a
        // sliver.
        const capsulePage = await browser.newPage({ viewport: CAPSULE });
        await capsulePage.goto(`${BASE}${c.path}`, { waitUntil: 'load', timeout: 15000 });
        await c.prepare(capsulePage, 'capsule');
        await capsulePage.screenshot({ path: capsulePath });
        await capsulePage.close();
        if (c.cropCapsule) {
          await runSips(['-c', String(c.cropCapsule[0]), String(c.cropCapsule[1]), capsulePath]);
          await runSips(['-z', String(CAPSULE.height), String(CAPSULE.width), capsulePath]);
        }
      }

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

      if (c.capsuleFromHero) {
        // Landscape-only game: the capsule is the middle 3:4 slice of the hero.
        const sliceW = Math.round(HERO.height * (CAPSULE.width / CAPSULE.height));
        await runSips(['-c', String(HERO.height), String(sliceW), heroPath, '--out', capsulePath]);
        await runSips(['-z', String(CAPSULE.height), String(CAPSULE.width), capsulePath]);
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n  ✓ ${todo.length} game(s) captured to public/covers/\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
