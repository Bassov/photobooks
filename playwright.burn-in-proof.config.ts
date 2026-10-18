import { defineConfig, devices } from '@playwright/test'

/** Dedicated config for burn-in timing proof — no webServer, not used by CI. */
export default defineConfig({
  testDir: './e2e/burn-in-fixtures',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/burn-in-proof.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
  },
})
