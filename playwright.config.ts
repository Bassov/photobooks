import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { loadGates } from './scripts/load-gates.mjs'

const isCi = Boolean(process.env.CI)
const e2ePort = process.env.E2E_PORT ?? '4173'
const e2eOrigin = `http://127.0.0.1:${e2ePort}`
const repoRoot = dirname(fileURLToPath(import.meta.url))
const gates = loadGates({ root: repoRoot })
// Istanbul on the e2e preview build adds main-thread overhead that trips LoAF
// frame-budget gates. Opt in with E2E_COVERAGE=1; webServer is still the only
// place that sets VITE_COVERAGE=1 on the build (never production/preview/LHCI).
const e2eCoverage = process.env.E2E_COVERAGE === '1'

/**
 * Mirrors scripts/e2e-flaky-list.mjs path rules for Playwright's TS config
 * (tsconfig.node cannot type-import repo .mjs without widening includes).
 */
function loadFlakyGlobs(): string[] {
  const paths = [
    ...new Set(
      gates.e2e.flakySpecs
        .map((entry: string) =>
          entry.trim().replaceAll('\\', '/').replace(/^\.\//, ''),
        )
        .filter((path: string) => path.length > 0),
    ),
  ].sort()
  for (const path of paths) {
    if (!path.startsWith('e2e/') || !path.endsWith('.spec.ts')) {
      throw new Error(
        `e2e.flakySpecs entry must be an e2e/**/*.spec.ts path, got ${path}`,
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
        retries: gates.playwright.flakyRetries,
        use: { ...devices['Desktop Chrome'] },
      }
    : null

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/burn-in-fixtures/**'],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: gates.playwright.retries,
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
    // VITE_COVERAGE=1 is set only here (not production/preview/LHCI). Opt out with
    // E2E_COVERAGE=0 when LoAF frame-budget assertions must run on a clean build.
    command: e2eCoverage
      ? `rm -rf .nyc_output coverage-e2e && VITE_COVERAGE=1 VITE_E2E=1 pnpm build && pnpm preview --host 127.0.0.1 --port ${e2ePort}`
      : `VITE_E2E=1 pnpm build && pnpm preview --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
