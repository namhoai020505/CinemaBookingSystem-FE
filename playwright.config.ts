import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      channel: 'msedge' // Uses built-in Microsoft Edge on Windows to bypass downloading
    }
  },
  projects: [
    {
      name: 'msedge',
      use: { channel: 'msedge' },
    }
  ]
});
