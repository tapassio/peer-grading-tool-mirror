import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT || '3999';

/**
 * End-to-end tests: a real browser against the built backend + frontend.
 * `npm test` starts the server itself (scripts/start-server.mjs) with a fresh
 * test database. Build backend and frontend first (see README.md).
 */
export default defineConfig({
  testDir: './tests',
  // the tests share one database: run them one after the other
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}/tc/PeerGrading/`,
    locale: 'de-CH',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // optional: an installed Chrome instead of the Playwright download
        launchOptions: process.env.E2E_CHROME
          ? { executablePath: process.env.E2E_CHROME }
          : {},
      },
    },
  ],
  webServer: {
    command: 'node scripts/start-server.mjs',
    url: `http://localhost:${port}/tc/PeerGrading/api/auth/config`,
    timeout: 60_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
