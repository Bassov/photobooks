import { afterEach, describe, expect, it } from 'vitest'

import {
  missingPillLabel,
  openRelinkReview,
  readRelinkPillCount,
  relinkPillCount,
  shouldShowMissingPill,
} from './hostModel'
import {
  isRelinkDialogOpen,
  markRelinkFound,
  replaceRelinkStatuses,
  resetRelinkStore,
} from './statusStore'

describe('hostModel', () => {
  afterEach(() => {
    resetRelinkStore()
  })

  it('pill helpers', () => {
    expect(relinkPillCount(2, 3, 1)).toBe(2)
    expect(shouldShowMissingPill(0)).toBe(false)
    expect(shouldShowMissingPill(1)).toBe(true)
    expect(missingPillLabel(2)).toBe('2 photos missing · export paused')
  })

  it('readRelinkPillCount mirrors store counters', () => {
    replaceRelinkStatuses(
      new Map([
        ['a', 'missing'],
        ['b', 'modified'],
      ]),
    )
    markRelinkFound(['a'])
    expect(readRelinkPillCount()).toBe(1)
  })

  it('openRelinkReview opens the dialog', () => {
    expect(isRelinkDialogOpen()).toBe(false)
    openRelinkReview()
    expect(isRelinkDialogOpen()).toBe(true)
  })
})
