// @ts-check
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PORT || 3014);
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: BASE,
    // CDN install of Playwright Chromium times out here; use installed Chrome.
    channel: 'chrome',
    trace: 'on-first-retry',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node server.js`,
        url: `${BASE}/api/agents`,
        reuseExistingServer: true,
        env: { ...process.env, PORT: String(PORT) },
        timeout: 60000,
      },
});
