import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 10000 },
  workers: 1,
  outputDir: '../output/admin-pages-mock-demo-v1-20261031/e2e-artifacts',
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    actionTimeout: 15000,
    baseURL: process.env.PUBLIC_DEMO_URL || 'http://127.0.0.1:5187/wuhan-eldercare-match/',
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PUBLIC_DEMO_URL
    ? undefined
    : {
        command: 'npm run preview:public-demo',
        url: 'http://127.0.0.1:5187/wuhan-eldercare-match/',
        reuseExistingServer: !process.env.CI,
      },
});
