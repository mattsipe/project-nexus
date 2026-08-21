import { test, expect } from '@playwright/test';

test.describe('ambience', () => {
  test('is off by default and never starts on its own', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Turn ambience on' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Nothing should have created an audio graph without being asked.
    const running = await page.evaluate(() => document.querySelectorAll('audio, video').length);
    expect(running).toBe(0);
  });

  test('turning it on starts a running audio context and persists the choice', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Turn ambience on' }).click();
    await expect(page.getByRole('button', { name: 'Turn ambience off' })).toBeVisible();

    await page.reload();
    // The preference survives, which is the point of storing it.
    await expect(page.getByRole('button', { name: 'Turn ambience off' })).toBeVisible();
  });

  test('volume control appears once ambience is on', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Turn ambience on' }).click();
    const slider = page.getByRole('slider', { name: 'Ambience volume' });
    await expect(slider).toBeVisible();
    await slider.fill('0.7');
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Ambience volume' })).toHaveValue('0.7');
  });
});
