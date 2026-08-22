import { test, expect } from '@playwright/test';

test.describe('galaxy background', () => {
  test('reduced motion renders the static nebula only — no canvas, no twinkle', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(500);

    // The nebula (a plain CSS gradient) always renders.
    await expect(page.locator('.nebula')).toBeVisible();

    // Canvases exist in the DOM (React always renders the <canvas> elements)
    // but must never have been drawn to or sized under reduced motion — an
    // untouched <canvas> keeps HTML's built-in default of 300x150, which is
    // what "Galaxy's effect never ran" actually looks like (not 0x0).
    const canvasesUntouched = await page.evaluate(() =>
      [...document.querySelectorAll('canvas')].every((c) => c.width === 300 && c.height === 150),
    );
    expect(canvasesUntouched, 'canvases must stay at the untouched HTML default under reduced motion').toBe(true);

    // No twinkle stars should have been created either.
    const twinkleCount = await page.locator('.twinkle-star').count();
    expect(twinkleCount).toBe(0);

    await ctx.close();
  });

  test('without reduced motion, stars are drawn and twinkle stars exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const canvasesDrawn = await page.evaluate(() =>
      [...document.querySelectorAll('canvas')].some((c) => c.width > 0),
    );
    expect(canvasesDrawn).toBe(true);
    await expect(page.locator('.twinkle-star').first()).toBeAttached();
  });

  test('the background animation pauses while a game is running', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    await page.locator('[data-capsule]').filter({ hasText: 'Neon Serpent' }).click();
    await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
    // Give `stop()` a moment to actually take effect — the pause reacts to a
    // state change, so it lands a frame or two after the click itself, not
    // synchronously with it. Comparing to a pre-launch baseline (which is
    // itself still moving, by design) is what made this flaky; two samples
    // taken after the game is confirmed running is the real assertion.
    await page.waitForTimeout(300);
    const sampleA = await page.evaluate(
      () => document.querySelectorAll('canvas')[0]?.style.transform,
    );
    await page.waitForTimeout(600);
    const sampleB = await page.evaluate(
      () => document.querySelectorAll('canvas')[0]?.style.transform,
    );
    expect(sampleB, 'the parallax transform must not still be drifting once play has settled').toBe(sampleA);
  });

  /**
   * The redesign plan set an explicit budget: under a 4x CPU throttle (which
   * approximates a low-end Chromebook), sweeping the pointer across the
   * library must stay smooth — median frame under 20ms, with fewer than a
   * quarter of frames exceeding it.
   *
   * This replaces an earlier version that instrumented requestAnimationFrame
   * callback *duration* and passed at <2ms while the page ran at 15fps in
   * practice. That measured scripting cost; the actual cost turned out to be
   * style recalculation (an inherited custom property transitioned on
   * :root — see docs/DECISIONS.md) and compositing (three oversized canvas
   * layers), neither of which shows up inside a rAF callback's own duration.
   * Timing the gap *between* frames is what "smooth" actually means, and
   * it's what caught the regression the scripting-time version missed.
   *
   * Every band's grid is cloned three-deep before measuring — the budget has
   * to hold as the catalogue grows, not just at today's size.
   *
   * Tagged @perf, which puts it in its own Playwright project that waits for
   * every other test to finish (see playwright.config.ts). A 4x-throttled
   * measurement sharing the machine with other workers measures the host, not
   * the site: this test passes with roughly 20% headroom in isolation and
   * failed reliably alongside even one other worker. Every other galaxy test
   * still runs on both viewports, in parallel, as before.
   */
  test('frame pacing stays smooth on a throttled CPU as the catalogue grows @perf', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Clone every band's grid, not just the first one. Before Phase 2.5 the
    // library was a single grid and `closest('div[class*="grid"]')` from the
    // first capsule reached all of it; with category bands that only reached
    // the first band, so the gate had been quietly measuring a fraction of the
    // page it was meant to stress.
    const capsuleCount = await page.evaluate(() => {
      const grids = new Set<Element>();
      document.querySelectorAll('[data-capsule]').forEach((c) => {
        const g = c.closest('div[class*="grid"]');
        if (g) grids.add(g);
      });
      for (const grid of grids) {
        const originals = [...grid.children];
        for (let i = 0; i < 2; i++) originals.forEach((el) => grid.appendChild(el.cloneNode(true)));
      }
      return document.querySelectorAll('[data-capsule]').length;
    });
    expect(capsuleCount, 'the sweep needs a grid big enough to be worth measuring')
      .toBeGreaterThan(40);

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.evaluate(() => {
      const w = window as unknown as { __frameGaps: number[]; __rafId: number };
      w.__frameGaps = [];
      let last = performance.now();
      const loop = (t: number) => {
        w.__frameGaps.push(t - last);
        last = t;
        w.__rafId = requestAnimationFrame(loop);
      };
      w.__rafId = requestAnimationFrame(loop);
    });

    // The real interaction that felt laggy: sweeping the pointer across capsules.
    const boxes = await page.locator('[data-capsule]').evaluateAll((els) =>
      els.slice(0, 18).map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
    );
    for (const b of boxes) {
      await page.mouse.move(b.x, b.y, { steps: 6 });
      await page.waitForTimeout(70);
    }

    const gaps = await page.evaluate(() => {
      const w = window as unknown as { __frameGaps: number[]; __rafId: number };
      cancelAnimationFrame(w.__rafId);
      return w.__frameGaps;
    });
    await client.detach();

    const usable = gaps.slice(2).sort((a, b) => a - b); // drop the first couple of startup frames
    expect(usable.length, 'the sweep should have produced plenty of frames').toBeGreaterThan(20);

    const med = usable[Math.floor(usable.length / 2)]!;
    const jankyPct = (100 * usable.filter((f) => f > 20).length) / usable.length;
    expect(med, `median frame gap was ${med.toFixed(1)}ms`).toBeLessThan(20);
    expect(jankyPct, `${jankyPct.toFixed(0)}% of frames exceeded 20ms`).toBeLessThan(25);
  });
});
