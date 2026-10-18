import { describe, expect, it } from 'vitest'
import {
  excludeFlakyFromTargets,
  flakyTestDirGlobs,
  loadFlakySpecPaths,
  normalizeFlakyPath,
} from './e2e-flaky-list.mjs'

describe('normalizeFlakyPath', () => {
  it('trims and normalizes separators', () => {
    expect(normalizeFlakyPath(' ./e2e\\foo.spec.ts ')).toBe('e2e/foo.spec.ts')
  })
})

describe('loadFlakySpecPaths', () => {
  it('returns sorted unique paths', () => {
    const paths = loadFlakySpecPaths({
      root: '/repo',
      exists: () => true,
      readFile: () =>
        JSON.stringify(['e2e/b.spec.ts', 'e2e/a.spec.ts', 'e2e/a.spec.ts']),
    })
    expect(paths).toEqual(['e2e/a.spec.ts', 'e2e/b.spec.ts'])
  })

  it('rejects non-array JSON', () => {
    expect(() =>
      loadFlakySpecPaths({
        root: '/repo',
        exists: () => true,
        readFile: () => '{}',
      }),
    ).toThrow(/must be a JSON array/)
  })

  it('rejects non-spec paths', () => {
    expect(() =>
      loadFlakySpecPaths({
        root: '/repo',
        exists: () => true,
        readFile: () => JSON.stringify(['e2e/helpers/x.ts']),
      }),
    ).toThrow(/e2e\/\*\*\/\*\.spec\.ts/)
  })

  it('requires the file', () => {
    expect(() =>
      loadFlakySpecPaths({
        root: '/repo',
        exists: () => false,
        readFile: () => '[]',
      }),
    ).toThrow(/required/)
  })
})

describe('flakyTestDirGlobs', () => {
  it('strips e2e/ prefix', () => {
    expect(flakyTestDirGlobs(['e2e/drag-swap.spec.ts'])).toEqual([
      'drag-swap.spec.ts',
    ])
  })
})

describe('excludeFlakyFromTargets', () => {
  it('drops listed paths', () => {
    expect(
      excludeFlakyFromTargets(
        ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/c.spec.ts'],
        ['e2e/b.spec.ts'],
      ),
    ).toEqual(['e2e/a.spec.ts', 'e2e/c.spec.ts'])
  })
})
