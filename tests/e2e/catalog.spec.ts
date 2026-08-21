import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

/** Read the manifest directly so the tests cover whatever is in the catalogue. */
const GAMES = readdirSync('src/content/games')
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => {
    const src = readFileSync(`src/content/games/${f}`, 'utf8');
    const get = (k: string) =>
      src.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
    return { slug: f.replace(/\.yaml$/, ''), title: get('title')!, mode: get('mode')! };
  });

/** Console errors are a test failure — a broken game is the whole product failing. */
function trackConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('home page renders the catalogue', async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Browser games');
  // Every game should be reachable from the home page.
  for (const g of GAMES) {
    await expect(page.locator(`a[href="/games/${g.slug}"]`).first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test('every game has a detail page that renders its provenance', async ({ page }) => {
  for (const g of GAMES) {
    const res = await page.goto(`/games/${g.slug}`);
    expect(res?.status(), `${g.slug} should return 200`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(g.title);
    // Provenance is non-negotiable: if we cannot say where it came from, it ships broken.
    await expect(page.getByText('Made by')).toBeVisible();
    await expect(page.getByText('Licence', { exact: true })).toBeVisible();
  }
});

test('self-hosted game bundles are actually served', async ({ request }) => {
  const selfHosted = GAMES.filter((g) => g.mode === 'selfhost');
  expect(selfHosted.length).toBeGreaterThan(0);
  for (const g of selfHosted) {
    const res = await request.get(`/play/${g.slug}/index.html`);
    expect(res.status(), `${g.slug} bundle should be served`).toBe(200);
  }
});

test('search finds a game by a partial, out-of-order query', async ({ page }) => {
  await page.goto('/');
  // The palette owns a global shortcut, so wait until that listener is live.
  await page.locator('html[data-search-ready="true"]').waitFor();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Search games' });
  await expect(input).toBeFocused();
  // Subsequence matching: "srpnt" is not a substring of "Neon Serpent".
  await input.fill('srpnt');
  await expect(page.getByRole('dialog').getByText('Neon Serpent')).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(/\/games\/neon-serpent/);
});

test('a favourite survives a reload and reaches the favourites page', async ({ page }) => {
  await page.goto('/games/2048');
  await page.getByRole('button', { name: 'Add to favourites' }).click();
  await expect(page.getByRole('button', { name: 'Favourited' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Favourited' })).toBeVisible();

  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: '2048' })).toBeVisible();
});

test('launching a self-hosted game records it in Jump back in', async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto('/games/neon-serpent');
  await page.getByRole('button', { name: /^Play Neon Serpent$/ }).click();

  const frame = page.frameLocator('iframe[title="Neon Serpent"]');
  await expect(frame.getByRole('heading', { name: 'Neon Serpent' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jump back in' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Neon Serpent actually plays', async ({ page }) => {
  await page.goto('/play/neon-serpent/index.html');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  // The snake must be moving: steer it and confirm the game survives a few ticks.
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(600);
  await expect(page.locator('#score')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
});

test('every page is free of horizontal overflow on a laptop viewport', async ({ page }) => {
  for (const path of ['/', '/games/2048', '/favorites', '/credits', '/settings', '/category/incremental']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `${path} should not scroll horizontally`).toBe(false);
  }
});

test('the player covers the site nav completely', async ({ page }) => {
  // Regression: `main` establishes a stacking context, so the overlay's z-index
  // alone did not lift it above the sticky nav. It is portalled to <body> now.
  await page.goto('/games/neon-serpent');
  await page.getByRole('button', { name: /^Play Neon Serpent$/ }).click();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();

  const navIsOnTop = await page.evaluate(() =>
    Boolean(document.elementFromPoint(90, 32)?.closest('header')),
  );
  expect(navIsOnTop, 'nav must not be visible above a running game').toBe(false);
});
