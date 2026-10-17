import { describe, expect, it } from 'vitest'
import {
  parseBurnInLine,
  resolveBurnInCount,
  slugFromBranch,
} from './e2e-burn-in-count.mjs'

describe('parseBurnInLine', () => {
  it('reads Burn-in: N', () => {
    expect(parseBurnInLine('# title\n\nBurn-in: 50\n')).toBe(50)
  })

  it('returns null when absent', () => {
    expect(parseBurnInLine('# title\n')).toBeNull()
  })
})

describe('slugFromBranch', () => {
  it.each([
    ['feat/e2e-burn-in', 'e2e-burn-in'],
    ['fix/foo-bar', 'foo-bar'],
    ['docs/m21', null],
    ['main', null],
  ])('%s → %s', (branch, slug) => {
    expect(slugFromBranch(branch)).toBe(slug)
  })
})

describe('resolveBurnInCount', () => {
  it('defaults to 10', () => {
    expect(resolveBurnInCount({ env: {}, branch: null })).toBe(10)
  })

  it('uses E2E_BURN_IN', () => {
    expect(
      resolveBurnInCount({ env: { E2E_BURN_IN: '12' }, branch: null }),
    ).toBe(12)
  })

  it('overrides with higher Burn-in from roadmap item', () => {
    expect(
      resolveBurnInCount({
        env: { E2E_BURN_IN: '10' },
        branch: 'feat/e2e-burn-in',
        findItemPath: () => '/repo/docs/roadmap/M2.1/e2e-burn-in.md',
        readItemFile: () => '# x\nBurn-in: 50\n',
      }),
    ).toBe(50)
  })

  it('keeps base when Burn-in is lower', () => {
    expect(
      resolveBurnInCount({
        env: { E2E_BURN_IN: '20' },
        branch: 'feat/e2e-burn-in',
        findItemPath: () => '/item.md',
        readItemFile: () => 'Burn-in: 5\n',
      }),
    ).toBe(20)
  })

  it('falls back when item is missing', () => {
    expect(
      resolveBurnInCount({
        env: { E2E_BURN_IN: '10' },
        branch: 'feat/e2e-burn-in',
        findItemPath: () => null,
      }),
    ).toBe(10)
  })
})
