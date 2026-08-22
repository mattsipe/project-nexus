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
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      grepInvert: /@perf/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grepInvert: /@perf/ },
    // The frame-pacing gate runs a 4x CPU-throttled measurement, which is only
    // meaningful with the machine to itself: sharing it with even one other
    // worker cost enough of the budget to fail a test that passes with ~20%
    // headroom in isolation. `dependencies` holds it back until everything else
    // has finished, so the number it reports is the site's, not the host's.
    // It measures at the laptop viewport because that is where CLAUDE.md
    // defines the budget.
    {
      name: 'perf',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      grep: /@perf/,
      dependencies: ['laptop', 'mobile'],
    },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
