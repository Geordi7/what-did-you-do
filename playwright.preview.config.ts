import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.config';

export default defineConfig({
  ...browserConfig,
  testMatch: '**/*.smoke.ts',
  outputDir: 'test-results-preview',
  use: { ...browserConfig.use, baseURL: 'http://127.0.0.1:5175' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    stdout: 'ignore',
  },
});
