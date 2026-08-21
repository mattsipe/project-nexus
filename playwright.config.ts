import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Two projects (laptop + mobile) each spawn their own worker pool, so an
  // uncapped run can try to hold ~2x this many real Chromium instances at
  // once, one of them deliberately 4x CPU-throttled by the galaxy perf test.
  // On an 8-core dev machine that oversubscribed the host badly enough to
  // fail otherwise-reliable, condition-waited tests purely from contention —
  // confirmed by re-running the exact same suite at a lower cap and getting
  // a clean pass every time. Capping leaves real headroom instead of
  // chasing each failure with more synthetic waits.
  workers: process.env.CI ? undefined : 2,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    // The primary target is a school-issue laptop, so that viewport is the
    // default rather than an afterthought.
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
