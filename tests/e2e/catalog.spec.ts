import { test, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

/** Read the manifest directly so the tests cover whatever is in the catalogue. */
const GAMES = readdirSync('src/content/games')
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => {
    const src = readFileSync(`src/content/games/${f}`, 'utf8');
    const get = (k: string) =>
      src.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
    const categories = (get('categories') ?? '')
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    return { slug: f.replace(/\.yaml$/, ''), title: get('title')!, mode: get('mode')!, categories };
  });

/** Playable games in a category — the grid never shows external entries. */
function inCategory(category: string): number {
  return GAMES.filter((g) => g.mode !== 'external' && g.categories.includes(category)).length;
}

/**
 * Astro stamps an un-hydrated island with an `ssr` attribute and removes it
 * once the client component mounts. Library binds its keyboard shortcuts and
 * its grid arrow-navigation in effects, so anything that presses a key
 * straight after `goto` is racing hydration — a race the tests won at nine
 * games and started losing at fifteen. Wait for the real signal instead.
 */
async function waitForLibrary(page: Page): Promise<void> {
  await page.locator('astro-island[component-url*="Library"]:not([ssr])').waitFor({ timeout: 10000 });
}

/** Console errors are a test failure — a broken game is the whole product failing. */
function trackConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/**
 * The library launch animates the clicked capsule growing to fill the
 * screen (~420ms, via a CSS transform on the player wrapper). Waits for
 * React's own `grown` state (a data attribute, not a computed-style poll —
 * more direct, and immune to any transform precision noise under CPU load)
 * and then the transition's own known duration, so the wrapper is both
 * logically settled and geometrically in place before anything clicks it.
 */
async function waitForLaunchAnimation(page: Page): Promise<void> {
  await page.locator('[data-player-wrapper][data-grown="true"]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
}

test('home page renders every game as a launchable capsule', async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto('/');
  await expect(page.locator('[data-capsule]').first()).toBeVisible();
  // Every playable game gets a capsule; every game (playable or not) gets an
  // "About" info link into its detail page.
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

test('the search box is always present and narrows the grid live', async ({ page }) => {
  await page.goto('/');
  const playable = GAMES.filter((g) => g.mode !== 'external');
  const input = page.getByRole('searchbox', { name: 'Search games' });
  // No modal to open — search-first means the box is already on screen.
  await expect(input).toBeVisible();

  // ⌘K/Ctrl-K focuses it rather than opening anything.
  await waitForLibrary(page);
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();

  // Subsequence matching: "srpnt" is not a substring of "Neon Serpent", and a
  // title hit outranks the tagline hits the same query picks up elsewhere
  // (searchGames penalises those by 300). Asserting on the *ranking* rather
  // than on an exact result count, because the count is a function of how many
  // games happen to be in the catalogue.
  await input.fill('srpnt');
  const hits = page.locator('[data-capsule]');
  await expect(hits.first()).toContainText('Neon Serpent');
  expect(await hits.count()).toBeLessThan(playable.length / 3);

  // Clearing the query restores the full grid.
  await input.fill('');
  await expect(page.locator('[data-capsule]')).toHaveCount(playable.length);
});

test('category chips filter in place — no navigation, URL stays in sync', async ({ page }) => {
  await page.goto('/');
  await waitForLibrary(page);
  const urlBefore = page.url();
  await page.getByRole('button', { name: 'Puzzle', exact: true }).click();
  await expect(page).toHaveURL(/[?&]c=puzzle/);
  expect(page.url().split('?')[0]).toBe(urlBefore.split('?')[0]); // same document, just a query param
  const capsules = page.locator('[data-capsule]');
  await expect(capsules).toHaveCount(inCategory('puzzle'));
  await expect(capsules.first()).toBeVisible();

  // The back button un-filters, since the chip click pushed history.
  await page.goBack();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a favourite survives a reload and reaches the favourites view', async ({ page }) => {
  await page.goto('/games/2048');
  await page.getByRole('button', { name: 'Add to favourites' }).click();
  await expect(page.getByRole('button', { name: 'Favourited' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Favourited' })).toBeVisible();

  await page.goto('/favorites');
  await expect(page.locator('[data-capsule]')).toContainText('2048');
});

test('launching a game inline records it in Continue, with no page navigation', async ({ page }) => {
  const errors = trackConsole(page);
  await page.goto('/');
  await waitForLibrary(page);
  const urlBefore = page.url();

  const neonSerpent = page.locator('[data-capsule]').filter({ hasText: 'Neon Serpent' });
  await neonSerpent.click();
  expect(page.url()).toBe(urlBefore); // click-to-launch never navigates

  const frame = page.frameLocator('iframe[title="Neon Serpent"]');
  await expect(frame.getByRole('heading', { name: 'Neon Serpent' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
  // Launching immediately adds the game to Continue, so by this point it
  // legitimately appears twice on the page (Continue row + main grid,
  // both hidden under the player overlay) — assert at least one, not "the".
  await expect(page.getByRole('link', { name: 'About Neon Serpent' }).first()).toBeVisible();
  await waitForLaunchAnimation(page);

  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('Continue', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('arrow keys move focus around the library grid', async ({ page }) => {
  await page.goto('/');
  await waitForLibrary(page);
  const capsules = page.locator('[data-capsule]');
  await capsules.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(capsules.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(capsules.nth(0)).toBeFocused();
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

test('the player covers the rail completely', async ({ page }) => {
  // Regression: `main` establishes a stacking context, so the overlay's z-index
  // alone did not lift it above the rail. It is portalled to <body> now.
  await page.goto('/');
  await waitForLibrary(page);
  await page.locator('[data-capsule]').filter({ hasText: 'Neon Serpent' }).click();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
  await waitForLaunchAnimation(page);

  const railIsOnTop = await page.evaluate(() =>
    Boolean(document.elementFromPoint(30, 30)?.closest('nav[aria-label="Primary"]')),
  );
  expect(railIsOnTop, 'rail must not be visible above a running game').toBe(false);
});

test('/category deep links render pre-filtered, and /favorites pre-filters to favourites', async ({ page }) => {
  await page.goto('/category/puzzle');
  await expect(page.locator('[data-capsule]')).toHaveCount(inCategory('puzzle'));
  await expect(page.getByRole('button', { name: 'Puzzle', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/favorites');
  await expect(page.getByRole('button', { name: 'Favourites only' })).toHaveAttribute('aria-pressed', 'true');
});
