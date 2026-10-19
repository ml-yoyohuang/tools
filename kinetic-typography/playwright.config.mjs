import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*.spec.mjs$/,
  timeout: 120_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199/',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5199/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } }],
});
