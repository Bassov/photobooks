import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '@playwright/test'

const COVERAGE_DIR = path.resolve(process.cwd(), '.nyc_output')

type CoverageWindow = Window & { __coverage__?: unknown }

/**
 * Auto fixture: after each test, dump Istanbul `window.__coverage__`
 * (injected when the Playwright webServer built with VITE_COVERAGE=1).
 * Specs import `test`/`expect` from this module instead of `@playwright/test`.
 */
export const test = base.extend<{ collectCoverage: null }>({
  collectCoverage: [
    async ({ page }, use, testInfo) => {
      await use(null)
      const cov = await page
        .evaluate(() => (window as CoverageWindow).__coverage__)
        .catch(() => undefined)
      if (cov === undefined || cov === null) return
      mkdirSync(COVERAGE_DIR, { recursive: true })
      const safe = testInfo.testId.replace(/[^a-z0-9_-]+/gi, '_')
      writeFileSync(
        path.join(COVERAGE_DIR, `e2e-${safe}.json`),
        JSON.stringify(cov),
      )
    },
    { auto: true },
  ],
})

export { expect }
