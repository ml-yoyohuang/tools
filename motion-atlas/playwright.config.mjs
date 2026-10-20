import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: 'http://localhost:5288/',
    viewport: { width: 1280, height: 860 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5288/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } }],
});
