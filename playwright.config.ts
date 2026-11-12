import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/ui/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './tests/ui/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: './output/playwright/test-results',
  reporter: [['list'], ['json', { outputFile: './output/playwright/results.json' }]],
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3313',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseURL ? undefined : {
    command: './node_modules/.bin/next dev --webpack --hostname 127.0.0.1 --port 3313',
    url: 'http://127.0.0.1:3313/login',
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    // E2E는 목 SDK 화면 흐름을 검증한다(실제 Supabase 연결과 분리).
    env: { NEXT_PUBLIC_DATA_MODE: 'mock' },
  },
});
