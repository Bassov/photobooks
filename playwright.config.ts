import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const e2ePort = process.env.E2E_PORT ?? '4173'
const e2eOrigin = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/burn-in-fixtures/**'],
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
    baseURL: e2eOrigin,
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
    // E2E_PORT isolates parallel worktree agents; never reuse another cwd's server.
    command: `VITE_E2E=1 pnpm build && pnpm preview --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
