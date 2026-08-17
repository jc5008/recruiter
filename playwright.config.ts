import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localPort = process.env.PLAYWRIGHT_PORT || '3000';
const localBaseUrl = `http://127.0.0.1:${localPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl ? undefined : {
    command: `npm run dev -- -p ${localPort}`,
    url: localBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
