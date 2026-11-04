import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  outputDir: '.cache/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:4173/midi_input_test/',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/midi_input_test/',
    reuseExistingServer: false,
  },
});
