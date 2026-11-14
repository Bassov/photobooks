import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  PREFLIGHT_RULE_IDS,
  PREFLIGHT_SEVERITIES,
  pageList,
  preflightRows,
  preflightRules,
  type PreflightColorIssue,
  type PreflightIssue,
} from '../index'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const profile = {
  name: 'Generic',
  safeMarginMm: 5,
  colorSpace: 'srgb',
} as const

const pageArb = fc.integer({ min: 1, max: 200 })

const issueArb: fc.Arbitrary<PreflightIssue> = fc
  .record({
    rule: fc.constantFrom(...PREFLIGHT_RULE_IDS),
    page: fc.option(pageArb, { nil: undefined }),
    threshold: fc.integer({ min: 1, max: 400 }),
  })
  .map(({ rule, page, threshold }) => ({
    rule,
    ...preflightRules()[rule],
    location: page === undefined ? {} : { page },
    measured: 1,
    threshold,
  }))

const colorArb: fc.Arbitrary<PreflightColorIssue> = fc.record({
  family: fc.constantFrom('adobe-rgb', 'display-p3', 'other-rgb'),
  pages: fc.array(pageArb, { maxLength: 4 }),
})

const inputArb = fc.record({
  issues: fc.array(issueArb, { maxLength: 40 }),
  colors: fc.array(colorArb, { maxLength: 10 }),
})

describe('preflightRows (properties)', () => {
  it('orders rows errors → warnings → info', () => {
    fc.assert(
      fc.property(inputArb, ({ issues, colors }) => {
        const ranks = preflightRows({ issues, colors, profile }).map(
          ({ severity }) => PREFLIGHT_SEVERITIES.indexOf(severity),
        )
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
      }),
      runs,
    )
  })

  it('puts every input issue in exactly one row', () => {
    fc.assert(
      fc.property(inputArb, ({ issues, colors }) => {
        const rows = preflightRows({ issues, colors, profile })
        const ids = rows.map(({ id }) => id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const row of rows) {
          const expected =
            row.id === 'color-space'
              ? colors.length
              : issues.filter(({ rule }) => rule === row.id).length
          expect(row.count).toBe(expected)
        }
        expect(rows.reduce((sum, { count }) => sum + count, 0)).toBe(
          issues.length + colors.length,
        )
      }),
      runs,
    )
  })

  it('lists at most five pages, then +n with n = the rest', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(pageArb, { minLength: 1, maxLength: 30 }),
        (pages) => {
          const sorted = [...pages].sort((a, b) => a - b)
          const match = /^ · pages? ([\d, ]+?)(?: \+(\d+))?$/.exec(
            pageList(sorted),
          )
          const shown = (match?.[1] ?? '').split(', ').map(Number)
          expect(shown).toEqual(sorted.slice(0, 5))
          expect(Number(match?.[2] ?? 0)).toBe(Math.max(0, sorted.length - 5))
        },
      ),
      runs,
    )
  })
})
