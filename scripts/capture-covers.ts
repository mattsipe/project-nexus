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
import { chromium, type Page } from '@playwright/test';
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
   * Frame the shot on something the game put somewhere unpredictable.
   *
   * The fixed centre-crops above assume the interesting part of the game sits
   * in the middle of the viewport. For a game whose subject wanders — Snake's
   * snake ends a scripted run wherever it ends — that assumption fails
   * intermittently, which is worse than failing every time. Return a rect in
   * viewport coordinates and the screenshot is clipped to it instead.
   */
  clipTo?: (page: Page, kind: 'capsule' | 'hero') => Promise<{ x: number; y: number; width: number; height: number } | null>;
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
    slug: 'snake',
    path: '/play/snake/index.html',
    // Crop to the board. The full page is mostly empty playing field plus a
    // theme picker, and a cover should show the game, not its chrome.
    // The board is a fixed 720px-wide box, wider than the 600px capsule
    // viewport, so a portrait capture would clip it. Take the capsule as the
    // middle slice of the landscape hero instead.
    capsuleFromHero: true,
    // A fixed centre-crop framed the snake only about half the time — a
    // scripted run ends wherever it ends. Frame on the snake itself instead.
    // On the snake alone, not the snake and its food: including the food
    // pulled the centre off toward whichever corner it had spawned in, and
    // the capsule (the middle slice of this) then framed the food and missed
    // the snake entirely.
    clipTo: async (page) => {
      const box = await page.evaluate(
        () =>
          (window as unknown as {
            __nexusFrame?: { cx: number; cy: number; field: { left: number; top: number; right: number; bottom: number } };
          }).__nexusFrame ?? null,
      );
      if (!box) return null;
      // The whole board, not a tight window on the snake. A tight window
      // frames beautifully when the snake is mid-board and clips it against
      // an edge when it is not, and the capsule — the middle slice of this —
      // then shows an empty corner. The board always contains the snake.
      const height = box.field.bottom - box.field.top;
      const width = Math.min(height * (16 / 9), box.field.right - box.field.left);
      const h = Math.min(height, width * (9 / 16));
      return {
        x: Math.min(Math.max(box.cx - width / 2, box.field.left), box.field.right - width),
        y: Math.min(Math.max(box.cy - h / 2, box.field.top), box.field.bottom - h),
        width,
        height: h,
      };
    },
    // A snake one block long is not a picture of Snake. Steering blind never
    // reliably found food, so the capture plays properly: read the food's
    // position off the DOM and chase it greedily until the tail is long
    // enough to read as a game in progress. Easy mode gives the chase enough
    // time per tick to actually land its turns.
    prepare: async (page) => {
      // Easy mode: the slowest tick, so each scripted turn actually lands.
      await page.selectOption('#selectMode', '100');
      await page.getByRole('button', { name: 'Play Game' }).click();
      await page.waitForTimeout(300);

      /** Head, target and wall clearances, or null once the snake is dead. */
      const read = (targetSel: string | null) =>
        page.evaluate((sel) => {
          const dead = document.querySelector('.snake-try-again-dialog') as HTMLElement | null;
          if (dead && dead.offsetParent !== null) return null;
          const head = document.querySelector('.snake-snakebody-alive');
          const field = document.querySelector('.snake-playing-field');
          if (!head || !field) return null;
          const h = head.getBoundingClientRect();
          const f = field.getBoundingClientRect();
          let target = { x: (f.left + f.right) / 2, y: (f.top + f.bottom) / 2 };
          if (sel) {
            const t = document.querySelector(sel);
            if (!t) return null;
            const r = t.getBoundingClientRect();
            target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
          const body = [...document.querySelectorAll('.snake-snakebody-alive')].map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          });
          return {
            len: body.length,
            block: h.width,
            hx: h.left + h.width / 2,
            hy: h.top + h.height / 2,
            dx: target.x - (h.left + h.width / 2),
            dy: target.y - (h.top + h.height / 2),
            body,
            clear: {
              ArrowLeft: h.left - f.left,
              ArrowRight: f.right - h.right,
              ArrowUp: h.top - f.top,
              ArrowDown: f.bottom - h.bottom,
            } as Record<string, number>,
          };
        }, targetSel);

      const flip: Record<string, string> = {
        ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft',
        ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp',
      };
      let heading = '';

      /** Steer greedily toward `target` for at most `ticks`, avoiding walls. */
      const chase = async (target: string | null, ticks: number, until?: (s: NonNullable<Awaited<ReturnType<typeof read>>>) => boolean) => {
        for (let i = 0; i < ticks; i++) {
          const st = await read(target);
          if (!st) return false;
          if (until?.(st)) return true;
          const wanted = Math.abs(st.dx) > Math.abs(st.dy)
            ? [st.dx > 0 ? 'ArrowRight' : 'ArrowLeft', st.dy > 0 ? 'ArrowDown' : 'ArrowUp']
            : [st.dy > 0 ? 'ArrowDown' : 'ArrowUp', st.dx > 0 ? 'ArrowRight' : 'ArrowLeft'];
          // Wall clearance only. Self-avoidance was tried and made things
          // worse: which DOM node is the head and which is the tail tip is not
          // knowable from order alone, and guessing wrong makes the chase
          // refuse every direction. At the lengths this capture needs, a plain
          // greedy chase survives comfortably.
          const key = [...wanted, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].find(
            (k) => k !== flip[heading] && st.clear[k]! > st.block * 2,
          );
          if (!key) return false;
          if (key !== heading) await page.keyboard.press(key);
          heading = key;
          await page.waitForTimeout(112);
        }
        return true;
      };

      // Greedy chasing does not avoid the snake's own body, so a long enough
      // run eventually coils into itself. Rather than write a pathfinder for a
      // screenshot, aim for a modest length and simply restart on death — the
      // board resets to a one-block snake, so a failed attempt is detectable
      // and cheap to redo.
      // Grow, freeze, then check what actually survived.
      //
      // Two things made earlier versions of this flaky. Centring the snake
      // after growing it added scripted ticks, and every extra tick is another
      // chance to die — clipTo removes the need for it entirely. And accepting
      // a run *before* pausing meant the snake could die in the gap between
      // the check and the shutter, at which point the Space keypress meant for
      // pause landed on the death dialog and started a fresh one-block game.
      // So the freeze happens inside the attempt, and the length is verified
      // after it.
      const TARGET = 10;
      const ACCEPT = 6;
      let frozen = 0;
      for (let attempt = 0; attempt < 6; attempt++) {
        await chase('.snake-food-block', 80, (st) => st.len >= TARGET);
        // Walk back toward the middle so the capsule's centre slice frames the
        // snake rather than an empty corner. This used to be the main source
        // of flakiness — it adds ticks, and every tick is a chance to die —
        // but the freeze-and-verify below now catches that and retries, so it
        // can only cost an attempt, never the capture.
        await chase(null, 26, (st) => Math.abs(st.dx) < st.block * 3 && Math.abs(st.dy) < st.block * 3);

        const alive = await read(null);
        if (alive && alive.len >= ACCEPT) {
          await page.keyboard.press('Space');   // pause
          await page.waitForTimeout(200);
          const after = await page.evaluate(() => {
            const dead = document.querySelector('.snake-try-again-dialog') as HTMLElement | null;
            if (dead && dead.offsetParent !== null) return 0;
            return document.querySelectorAll('.snake-snakebody-alive').length;
          });
          if (after >= ACCEPT) {
            frozen = after;
            break;
          }
        }

        const again = page.getByRole('button', { name: 'Play Again?' });
        if (await again.isVisible().catch(() => false)) {
          await again.click();
          await page.waitForTimeout(350);
        }
        heading = '';
      }
      if (!frozen) throw new Error(`snake capture: no run reached ${ACCEPT} segments alive`);

      // Record the framing NOW, while the board is paused but nothing has
      // been hidden yet. Measuring it later, from clipTo, gave zero-sized
      // rects and a window parked in the board's top-left corner.
      await page.evaluate(() => {
        const parts = [...document.querySelectorAll('.snake-snakebody-alive')].map((el) =>
          el.getBoundingClientRect(),
        );
        const field = document.querySelector('.snake-playing-field');
        if (!parts.length || !field) return;
        const f = field.getBoundingClientRect();
        (window as unknown as { __nexusFrame: unknown }).__nexusFrame = {
          cx: (Math.min(...parts.map((r) => r.left)) + Math.max(...parts.map((r) => r.right))) / 2,
          cy: (Math.min(...parts.map((r) => r.top)) + Math.max(...parts.map((r) => r.bottom))) / 2,
          field: { left: f.left, top: f.top, right: f.right, bottom: f.bottom },
        };
      });

      // The pause overlay is transient chrome, and the author's credit strip
      // belongs in the game rather than in its cover art — the same
      // attribution is on the detail page and /credits.
      await page.addStyleTag({
        content:
          '.snake-pause-screen, .snake-try-again-dialog, .snake-welcome-dialog,' +
          '.snake-panel-component { display: none !important; }',
      });
      await page.waitForTimeout(120);
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
    slug: 'flappy',
    path: '/play/flappy/index.html',
    // The playfield is a tall column with a lot of empty sky; crop onto the
    // band the bird and the pipe gap actually occupy.
    cropCapsule: [560, 420],
    cropHero: [400, 711],
    // Space leaves the splash; after that the bird needs a flap roughly every
    // third of a second to hold altitude. Too few and it is on the ground when
    // the shutter opens, too many and it climbs into the ceiling. Stop as soon
    // as a pipe pair is on screen beside the bird, which is the picture that
    // actually says what this game is.
    prepare: async (page) => {
      // The credit strip belongs in the game, not in its cover art; the
      // attribution it carries is also on the detail page and /credits.
      await page.addStyleTag({ content: '#footer { display: none !important; }' });
      await page.waitForTimeout(900);
      await page.keyboard.press('Space');
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        const framed = await page.evaluate(() => {
          const bird = document.querySelector('#player');
          const pipes = [...document.querySelectorAll('.pipe')];
          if (!bird || !pipes.length) return false;
          const b = bird.getBoundingClientRect();
          // A pipe whose gap the bird is about to fly through.
          return pipes.some((p) => {
            const r = p.getBoundingClientRect();
            return r.left > b.right - 40 && r.left < b.right + 260;
          });
        });
        if (framed && i > 3) break;
      }
    },
  },
  {
    slug: 'belt-runner',
    path: '/play/belt-runner/index.html',
    // Vector line art, light-on-ink since the bundle was inverted for the
    // launcher. The playfield is a fixed 780x540 box — wider than the 600px
    // capsule viewport, so the capsule is taken as the middle slice of the
    // landscape hero rather than a clipped portrait shot.
    capsuleFromHero: true,
    cropHero: [546, 786],
    prepare: async (page) => {
      await page.waitForTimeout(1200);
      // Game.FSM.state drives everything: 'waiting' is the start prompt, 'run'
      // is a live game. Wait for the real transition rather than guessing at
      // timings — the ship has one life, so a run that ends early puts the
      // prompt back and the cover becomes a screenshot of a title screen.
      // KEY_STATUS.space is sampled once per frame, so a normal press is over
      // before the game looks at it — hold it across a few frames instead.
      // Same shape of problem as radius-raid's menu.
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.keyboard.down('Space');
        await page.waitForTimeout(140);
        await page.keyboard.up('Space');
        await page.waitForTimeout(700);
        const running = await page.evaluate(
          () => (window as unknown as { Game: { FSM: { state: string } } }).Game.FSM.state === 'run',
        );
        if (running) break;
      }
      // Deliberately do NOT shoot. Destroying asteroids empties the field,
      // and an empty field is exactly what made the first version of this
      // cover look like a failed render. Just turn on the spot so the ship is
      // angled rather than axis-aligned, and let the five spawned asteroids
      // drift into frame.
      // Five asteroids across a 780x540 field leaves most of the frame empty,
      // and the capsule is a slice of that frame. Spawn a few more for the
      // shot; the shipped game's own difficulty curve is untouched.
      await page.evaluate(() =>
        (window as unknown as { Game: { spawnAsteroids: (n: number) => void } }).Game.spawnAsteroids(6),
      );
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(260);
      await page.keyboard.up('ArrowLeft');
      await page.waitForTimeout(1700);
      await page.waitForTimeout(300);
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
    // The table is a wide fixed-ratio canvas, so a portrait capture is mostly
    // black. Crop into it — a partial table reads better on a 235px card than
    // a whole one the size of a stamp.
    cropCapsule: [440, 330],
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
        const capsuleClip = c.clipTo ? await c.clipTo(capsulePage, 'capsule') : null;
        await capsulePage.screenshot({ path: capsulePath, ...(capsuleClip ? { clip: capsuleClip } : {}) });
        if (capsuleClip) await runSips(['-z', String(CAPSULE.height), String(CAPSULE.width), capsulePath]);
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
        const heroClip = c.clipTo ? await c.clipTo(heroPage, 'hero') : null;
        await heroPage.screenshot({ path: heroPath, ...(heroClip ? { clip: heroClip } : {}) });
        if (heroClip) await runSips(['-z', String(HERO.height), String(HERO.width), heroPath]);
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
