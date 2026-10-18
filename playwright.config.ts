import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const e2ePort = process.env.E2E_PORT ?? '4173'
const e2eOrigin = `http://127.0.0.1:${e2ePort}`
const repoRoot = dirname(fileURLToPath(import.meta.url))

/**
 * Mirrors scripts/e2e-flaky-list.mjs for Playwright's TS config project
 * (tsconfig.node cannot type-import repo .mjs without widening includes).
 */
function loadFlakyGlobs(): string[] {
  const raw: unknown = JSON.parse(
    readFileSync(join(repoRoot, 'e2e/flaky.json'), 'utf8'),
  )
  if (!Array.isArray(raw)) {
    throw new Error('e2e/flaky.json must be a JSON array of spec paths')
  }
  const paths = [
    ...new Set(
      raw
        .map((entry) =>
          String(entry).trim().replaceAll('\\', '/').replace(/^\.\//, ''),
        )
        .filter((path) => path.length > 0),
    ),
  ].sort()
  for (const path of paths) {
    if (!path.startsWith('e2e/') || !path.endsWith('.spec.ts')) {
      throw new Error(
        `e2e/flaky.json entry must be an e2e/**/*.spec.ts path, got ${path}`,
      )
    }
  }
  return paths.map((path) => path.slice('e2e/'.length))
}

const flakyGlobs = loadFlakyGlobs()

const chromiumProject = {
  name: 'chromium',
  testIgnore: ['**/burn-in-fixtures/**', ...flakyGlobs],
  use: { ...devices['Desktop Chrome'] },
}

const flakyProject =
  flakyGlobs.length > 0
    ? {
        name: 'flaky',
        testMatch: flakyGlobs,
        retries: 2,
        use: { ...devices['Desktop Chrome'] },
      }
    : null

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/burn-in-fixtures/**'],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: 0,
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
    trace: 'retain-on-failure',
  },
  projects: flakyProject ? [chromiumProject, flakyProject] : [chromiumProject],
  webServer: {
    // VITE_E2E exposes `__photobooksProject` in the production preview build.
    // E2E_PORT isolates parallel worktree agents; never reuse another cwd's server.
    command: `VITE_E2E=1 pnpm build && pnpm preview --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
