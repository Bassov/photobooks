import { describe, expect, it } from 'vitest'
import {
  countFlakyRetriedPasses,
  formatE2eSectionMarkdown,
  intermittentPassRunner,
  runBurnInInvocation,
} from './e2e-playwright-summary.mjs'
import { resolve } from 'node:path'

describe('countFlakyRetriedPasses', () => {
  it('counts retried passes', () => {
    const report = {
      suites: [
        {
          specs: [
            {
              tests: [
                {
                  results: [{ status: 'failed' }, { status: 'passed' }],
                },
                {
                  results: [{ status: 'passed' }],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(countFlakyRetriedPasses(report)).toBe(1)
  })

  it('returns 0 when nothing flaked', () => {
    expect(
      countFlakyRetriedPasses({
        suites: [{ specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] }],
      }),
    ).toBe(0)
  })
})

describe('formatE2eSectionMarkdown', () => {
  it('includes flaky and burn-in rows', () => {
    const body = formatE2eSectionMarkdown({ burnInCount: 50, flakyCount: 2 })
    expect(body).toContain('| Flaky (retried pass) | 2 |')
    expect(body).toContain('| Burn-in | 50 |')
  })

  it('omits burn-in when null', () => {
    const body = formatE2eSectionMarkdown({ burnInCount: null, flakyCount: 0 })
    expect(body).toContain('| Flaky (retried pass) | 0 |')
    expect(body).not.toContain('| Burn-in |')
  })
})

describe('timing-dependent burn-in harness', () => {
  it('intermittent runner fails on odd attempts', () => {
    expect(intermittentPassRunner({ attempt: 1, total: 10 }).ok).toBe(false)
    expect(intermittentPassRunner({ attempt: 2, total: 10 }).ok).toBe(true)
  })

  it('burn-in harness exits non-zero under repeat-each with retries=0', () => {
    const script = resolve('scripts/e2e-playwright-summary.mjs')
    const result = runBurnInInvocation({
      command: process.execPath,
      args: [
        script,
        'burn-in-harness',
        '--repeat-each',
        '10',
        '--retries',
        '0',
      ],
    })
    expect(result.status).not.toBe(0)
  })
})
