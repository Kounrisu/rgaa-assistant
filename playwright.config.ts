import { defineConfig } from '@playwright/test'

// Browser smoke test of the BUILT extension (run `npm run build` first). See "Develop" in the README.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  use: { actionTimeout: 10_000, trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true, viewport: { width: 1280, height: 900 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node e2e/server.mjs', url: 'http://127.0.0.1:4173/manifest.json', reuseExistingServer: !process.env.CI, timeout: 20_000 },
})
