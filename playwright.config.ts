import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'reports/browser-tests.json' }]],
  use: { baseURL: 'http://127.0.0.1:4321', channel: 'chrome', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node scripts/serve.mjs --port 4321', url: 'http://127.0.0.1:4321', reuseExistingServer: !process.env.CI },
    { command: 'node scripts/serve.mjs --port 4322 --live', url: 'http://127.0.0.1:4322', reuseExistingServer: !process.env.CI },
  ],
});
