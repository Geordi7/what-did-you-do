import { defineConfig, devices } from '@playwright/test';

// The browser tier, per 05-02-browser-tier.md.
// Dev server rather than preview: the CSP meta tag is build-only (02-architecture.md),
// and these cases assert storage and DOM behaviour, not the policy.
// One worker, because every case seeds this one origin's localStorage.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
});
