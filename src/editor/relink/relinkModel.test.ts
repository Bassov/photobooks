import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'

import {
  badgeLabel,
  isResolveDisabled,
  pillCount,
  relinkTitle,
  resolveLabel,
  rowDataStatus,
  scanPercent,
  selectRelinkRows,
  shouldDetectOnActivation,
  unresolvedProblemCount,
} from './relinkModel'

describe('relinkModel', () => {
  it('selectRelinkRows filters problems vs all', () => {
    const statuses = new Map([
      ['a', 'missing' as const],
      ['b', 'modified' as const],
      ['c', 'ok' as const],
    ])
    const found = new Set(['a'])
    expect(selectRelinkRows(statuses, found, 'problems')).toEqual([
      { assetId: 'a', status: 'missing', found: true },
      { assetId: 'b', status: 'modified', found: false },
    ])
    expect(selectRelinkRows(statuses, found, 'all')).toHaveLength(3)
  })

  it('relinkTitle and scanPercent edge cases', () => {
    expect(relinkTitle(0)).toBe('No photos need attention')
    expect(relinkTitle(2)).toBe('2 photos need attention')
    expect(scanPercent(null)).toBe(0)
    expect(scanPercent({ total: 0, completed: 1 })).toBe(0)
    expect(scanPercent({ total: 10, completed: 4 })).toBe(40)
    expect(scanPercent({ total: 1, completed: 9 })).toBe(100)
  })

  it('unresolvedProblemCount ignores found ids', () => {
    const statuses = new Map([
      ['a', 'missing' as const],
      ['b', 'modified' as const],
    ])
    expect(unresolvedProblemCount(statuses, new Set(['a']))).toBe(1)
  })

  test.prop([fc.nat(20), fc.nat(20), fc.nat(20)])(
    'pillCount never goes negative',
    (missing, problems, found) => {
      expect(pillCount(missing, problems, found)).toBeGreaterThanOrEqual(0)
    },
  )

  it('badge and resolve helpers cover status matrix', () => {
    expect(badgeLabel(true, 'missing')).toBe('Found')
    expect(badgeLabel(false, 'missing')).toBe('Missing')
    expect(badgeLabel(false, 'modified')).toBe('Modified')
    expect(badgeLabel(false, 'ok')).toBe('Linked')
    expect(rowDataStatus(true, 'missing')).toBe('found')
    expect(rowDataStatus(false, 'modified')).toBe('modified')
    expect(resolveLabel(0)).toBe('Resolve')
    expect(resolveLabel(3)).toBe('Resolve 3')
    expect(isResolveDisabled(0, false)).toBe(true)
    expect(isResolveDisabled(1, true)).toBe(true)
    expect(isResolveDisabled(1, false)).toBe(false)
  })

  it('shouldDetectOnActivation gates restore and permission', () => {
    expect(
      shouldDetectOnActivation({
        surface: 'editor',
        bookId: 'b',
        restorePending: false,
        accessPhase: 'idle',
      }),
    ).toBe(true)
    expect(
      shouldDetectOnActivation({
        surface: 'home',
        bookId: 'b',
        restorePending: false,
        accessPhase: 'idle',
      }),
    ).toBe(false)
    expect(
      shouldDetectOnActivation({
        surface: 'editor',
        bookId: null,
        restorePending: false,
        accessPhase: 'idle',
      }),
    ).toBe(false)
    expect(
      shouldDetectOnActivation({
        surface: 'editor',
        bookId: 'b',
        restorePending: true,
        accessPhase: 'idle',
      }),
    ).toBe(false)
    expect(
      shouldDetectOnActivation({
        surface: 'editor',
        bookId: 'b',
        restorePending: false,
        accessPhase: 'permission-required',
      }),
    ).toBe(false)
  })
})
