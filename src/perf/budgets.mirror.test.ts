import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PERF_BUDGETS } from './budgets'

describe('e2e budgets mirror', () => {
  it('matches src/perf/budgets.ts numeric values', () => {
    const mirrorPath = resolve(import.meta.dirname, '../../e2e/perf/budgets.ts')
    const source = readFileSync(mirrorPath, 'utf8')
    for (const [key, value] of Object.entries(PERF_BUDGETS)) {
      expect(source).toContain(`${key}: ${String(value)}`)
    }
  })
})
