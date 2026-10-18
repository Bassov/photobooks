import { describe, expect, it } from 'vitest'
import { loadGates, validateGates } from './load-gates.mjs'

const validGates = {
  coverage: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  stryker: {
    thresholds: { high: 80, low: 60, break: 60 },
  },
  lighthouse: {
    numberOfRuns: 1,
    assertions: { 'performance-budget': 'error' },
    budgets: [{ path: '/*', resourceSizes: [], resourceCounts: [] }],
  },
  playwright: { retries: 0, flakyRetries: 2 },
  e2e: { burnInDefault: 10, flakySpecs: ['e2e/a.spec.ts'] },
}

describe('validateGates', () => {
  it('accepts a complete gates object', () => {
    expect(validateGates(validGates)).toEqual(validGates)
  })

  it('rejects non-object root', () => {
    expect(() => validateGates([])).toThrow(/must be a JSON object/)
    expect(() => validateGates(null)).toThrow(/must be a JSON object/)
  })

  it('rejects missing coverage floors', () => {
    const { coverage: _ignored, ...rest } = validGates
    expect(() => validateGates(rest)).toThrow(/coverage must be an object/)
  })

  it('rejects bad coverage metric', () => {
    expect(() =>
      validateGates({
        ...validGates,
        coverage: { ...validGates.coverage, lines: -1 },
      }),
    ).toThrow(/coverage.lines/)
  })

  it('rejects bad stryker thresholds', () => {
    expect(() =>
      validateGates({
        ...validGates,
        stryker: { thresholds: null },
      }),
    ).toThrow(/stryker.thresholds must be an object/)
    expect(() =>
      validateGates({
        ...validGates,
        stryker: { thresholds: { high: 80, low: 60, break: 1.5 } },
      }),
    ).toThrow(/stryker.thresholds.break/)
  })

  it('rejects bad lighthouse fields', () => {
    expect(() =>
      validateGates({
        ...validGates,
        lighthouse: { ...validGates.lighthouse, numberOfRuns: 0 },
      }),
    ).toThrow(/numberOfRuns/)
    expect(() =>
      validateGates({
        ...validGates,
        lighthouse: { ...validGates.lighthouse, assertions: [] },
      }),
    ).toThrow(/assertions must be an object/)
    expect(() =>
      validateGates({
        ...validGates,
        lighthouse: { ...validGates.lighthouse, budgets: {} },
      }),
    ).toThrow(/budgets must be an array/)
  })

  it('rejects bad playwright retries', () => {
    expect(() =>
      validateGates({
        ...validGates,
        playwright: { retries: -1, flakyRetries: 2 },
      }),
    ).toThrow(/playwright.retries/)
  })

  it('rejects bad e2e fields', () => {
    expect(() =>
      validateGates({
        ...validGates,
        e2e: { burnInDefault: 0, flakySpecs: [] },
      }),
    ).toThrow(/burnInDefault/)
    expect(() =>
      validateGates({
        ...validGates,
        e2e: { burnInDefault: 10, flakySpecs: 'nope' },
      }),
    ).toThrow(/flakySpecs must be an array/)
    expect(() =>
      validateGates({
        ...validGates,
        e2e: { burnInDefault: 10, flakySpecs: [1] },
      }),
    ).toThrow(/flakySpecs entries must be strings/)
  })
})

describe('loadGates', () => {
  it('loads and validates from a fixture root', () => {
    const gates = loadGates({
      root: '/repo',
      readFile: () => JSON.stringify(validGates),
    })
    expect(gates.coverage.statements).toBe(80)
    expect(gates.e2e.burnInDefault).toBe(10)
    expect(gates.e2e.flakySpecs).toEqual(['e2e/a.spec.ts'])
  })

  it('uses injected readFile over defaults', () => {
    let seen = ''
    loadGates({
      root: '/custom',
      readFile: (path) => {
        seen = path
        return JSON.stringify(validGates)
      },
    })
    expect(seen.replaceAll('\\', '/')).toContain('/custom/quality/gates.json')
  })

  it('throws when JSON is invalid', () => {
    expect(() =>
      loadGates({
        root: '/repo',
        readFile: () => '{',
      }),
    ).toThrow(/Failed to load/)
  })

  it('throws when readFile throws', () => {
    expect(() =>
      loadGates({
        root: '/repo',
        readFile: () => {
          throw new Error('boom')
        },
      }),
    ).toThrow(/Failed to load/)
  })
})
