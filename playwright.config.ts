import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

const LOCAL_URL = 'http://127.0.0.1:20000';
export const E2E_ADMIN_TOKEN = 'e2e-admin-token';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`.
       By default the tests start the app locally (see webServer below), so a pull
       request is tested with its own code. Set BASE_URL to check a deployed site. */
    baseURL: process.env.BASE_URL || LOCAL_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    //{
    //  name: 'firefox',
    //  use: { ...devices['Desktop Firefox'] },
    //},
    //
    //{
    //  name: 'webkit',
    //  use: { ...devices['Desktop Safari'] },
    //},

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Start the app locally unless the tests target a deployed site.
     Its database is E2E_DATABASE_URL (CI: a Postgres service), else a SQLite file.
     DATABASE_URL is deliberately not passed on: in .env it points at production. */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `${process.env.PYTHON || 'python'} app.py`,
        url: LOCAL_URL,
        env: {
          PORT: '20000',
          DATABASE_URL: process.env.E2E_DATABASE_URL || 'sqlite:///e2e.db',
          // a throwaway token so the admin tests can sign in to the local server
          ADMIN_TOKEN: E2E_ADMIN_TOKEN,
        },
        reuseExistingServer: !process.env.CI,
      },
});
