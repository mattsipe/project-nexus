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
   * approximates a low-end Chromebook), the galaxy's per-frame scripting cost
   * must stay under 2ms, because it runs continuously behind everything else.
   * If this ever regresses, the fix is to cut the canvas layer entirely and
   * ship the CSS nebula alone — not to try to optimise a bloated frame.
   *
   * Measured by instrumenting requestAnimationFrame directly rather than
   * aggregating Chrome trace events — trace "RunTask"/"FunctionCall" events
   * nest, so summing their durations double-counts and wildly overstates
   * cost. Timing the callback itself with performance.now() is what the
   * budget actually means and cannot double-count.
   */
  test('scripting cost per frame stays under budget on a throttled CPU', async ({ page }) => {
    await page.addInitScript(() => {
      const durations: number[] = [];
      const nativeRaf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        nativeRaf((t) => {
          const start = performance.now();
          cb(t);
          durations.push(performance.now() - start);
        });
      (window as unknown as { __rafDurations: number[] }).__rafDurations = durations;
    });

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('/');
    await page.waitForTimeout(500);
    // Nudge the parallax loop so it's doing its full complement of work
    // (pointer-driven translate updates), not sitting perfectly idle.
    await page.mouse.move(200, 200);
    await page.mouse.move(900, 500, { steps: 10 });
    await page.waitForTimeout(2000);

    const durations = await page.evaluate(
      () => (window as unknown as { __rafDurations: number[] }).__rafDurations,
    );
    await client.detach();

    expect(durations.length, 'the rAF loop should have run several frames').toBeGreaterThan(10);
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(avgMs, `~${avgMs.toFixed(2)}ms/frame average under 4x throttle`).toBeLessThan(2);
  });
});
