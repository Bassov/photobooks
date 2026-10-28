import { describe, expect, it } from 'vitest'
import {
  collectScenarios,
  isPerfPath,
  isPerfScope,
  judge,
  main,
  worstBlockingMs,
} from './perf-lane.mjs'

const LOAF = (ms) =>
  `LoAF entries 1 exceed max 0 (worst blockingDuration ${String(ms)}ms)`

function report(...tests) {
  return {
    suites: [
      {
        title: 'a.spec.ts',
        suites: [
          {
            title: 'frame-budget gates',
            specs: tests.map(([title, status, message]) => ({
              title,
              tests: [
                {
                  results: [
                    {
                      status,
                      errors: message ? [{ message }] : [],
                    },
                  ],
                },
              ],
            })),
          },
        ],
      },
    ],
  }
}

describe('isPerfPath', () => {
  it.each([
    'src/render/SpreadView.tsx',
    'src/perf/loafObserver.ts',
    'src/photo/pool.ts',
    'src/assets/cache.ts',
    'src/editor/filmstrip/Filmstrip.tsx',
    'src/editor/Pasteboard.tsx',
    'e2e/perf/perfFixture.ts',
    'e2e/some-frame-pacing.spec.ts',
    'playwright.config.ts',
  ])('is in scope: %s', (file) => {
    expect(isPerfPath(file)).toBe(true)
  })

  it.each(['src/core/book.ts', 'docs/roadmap.md', 'e2e/book-titles.spec.ts'])(
    'is out of scope: %s',
    (file) => {
      expect(isPerfPath(file)).toBe(false)
    },
  )

  it('pulls in a spec that declares a frame-budget describe', () => {
    expect(isPerfPath('e2e/book-titles.spec.ts', () => true)).toBe(true)
    expect(isPerfScope(['docs/a.md', 'src/render/x.ts'])).toBe(true)
    expect(isPerfScope(['docs/a.md'])).toBe(false)
  })
})

describe('worstBlockingMs', () => {
  it('reads the worst value, ignoring ANSI colour codes', () => {
    expect(worstBlockingMs(`\u001b[31m${LOAF(37.5)}\u001b[0m`)).toBe(37.5)
    expect(worstBlockingMs('timeout')).toBe(0)
  })
})

describe('collectScenarios', () => {
  it('keys scenarios by suite path and marks failures', () => {
    const rows = collectScenarios(
      report(['ok', 'passed'], ['bad', 'failed', LOAF(30)]),
    )
    expect(rows.map((r) => [r.key, r.failed])).toEqual([
      ['a.spec.ts › frame-budget gates › ok', false],
      ['a.spec.ts › frame-budget gates › bad', true],
    ])
  })

  it('accepts a legacy single `error` field', () => {
    const rows = collectScenarios({
      suites: [
        {
          specs: [
            {
              title: 't',
              tests: [
                { results: [{ status: 'timedOut', error: { message: 'x' } }] },
              ],
            },
          ],
        },
      ],
    })
    expect(rows).toEqual([{ key: 't', failed: true, messages: ['x'] }])
  })
})

describe('judge', () => {
  const pass = report(['s', 'passed'])

  it('is green when every run passes', () => {
    expect(judge([pass, pass, pass])).toMatchObject({ pass: true, notes: [] })
  })

  it('tolerates one failing run of three, with a note', () => {
    const bad = report(['s', 'failed', LOAF(30)])
    const v = judge([pass, bad, pass])
    expect(v.pass).toBe(true)
    expect(v.notes).toHaveLength(1)
  })

  it('is red when two runs fail', () => {
    const bad = report(['s', 'failed', LOAF(30)])
    const v = judge([bad, pass, bad])
    expect(v.pass).toBe(false)
    expect(v.problems[0]).toContain('failed in runs 1, 3 of 3')
  })

  it('is red when any run blocks longer than 50 ms', () => {
    const bad = report(['s', 'failed', LOAF(80)])
    const v = judge([pass, pass, bad])
    expect(v.pass).toBe(false)
    expect(v.problems[0]).toContain('80ms')
  })

  it('is red without any scenarios', () => {
    expect(judge([]).pass).toBe(false)
  })
})

describe('main', () => {
  it('prints usage and exits 2 for unknown commands', () => {
    expect(main(['nope'])).toBe(2)
  })

  it('verdict is red when no report files exist', () => {
    expect(main(['verdict', '/nonexistent/report.json'])).toBe(1)
  })
})
