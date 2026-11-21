import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '@playwright/test'
import {
  type CoverageMap,
  type CoveragePayload,
  mergeCoverage,
  readPageCoverage,
} from './coverageMerge'

const COVERAGE_DIR = path.resolve(process.cwd(), '.nyc_output')

/**
 * Auto fixture: after each test, merge Istanbul `window.__coverage__`
 * (injected when the Playwright webServer built with VITE_COVERAGE=1) into the
 * worker's map; the worker writes one `.nyc_output/e2e-worker-*.json` on
 * teardown (also after a failed test restarts the worker).
 * Specs import `test`/`expect` from this module instead of `@playwright/test`.
 */
export const test = base.extend<
  { collectCoverage: null },
  { workerCoverage: CoverageMap }
>({
  workerCoverage: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures require a destructured first argument
    async ({}, use, workerInfo) => {
      const map: CoverageMap = {}
      await use(map)
      if (Object.keys(map).length === 0) return
      mkdirSync(COVERAGE_DIR, { recursive: true })
      writeFileSync(
        path.join(
          COVERAGE_DIR,
          `e2e-worker-${String(workerInfo.workerIndex)}-${String(process.pid)}.json`,
        ),
        JSON.stringify(map),
      )
    },
    { scope: 'worker' },
  ],
  collectCoverage: [
    async ({ page, workerCoverage }, use) => {
      await use(null)
      const json = await page
        .evaluate(readPageCoverage, Object.keys(workerCoverage))
        .catch(() => null)
      if (json === null) return
      mergeCoverage(workerCoverage, JSON.parse(json) as CoveragePayload)
    },
    { auto: true },
  ],
})

export { expect }
