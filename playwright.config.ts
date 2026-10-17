import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: isCi
    ? [
        ['list'],
        ['html', { open: 'never' }],
        [
          'json',
          {
            outputFile:
              process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
              'test-results/e2e-results.json',
          },
        ],
      ]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // VITE_E2E exposes `__photobooksProject` in the production preview build.
    command:
      'VITE_E2E=1 pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
})
