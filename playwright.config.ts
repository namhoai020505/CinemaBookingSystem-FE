import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env.test for E2E test credentials
dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,   // Sequential: tests share a live DB
  workers: 1,             // Single worker to avoid FK / unique conflicts
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
