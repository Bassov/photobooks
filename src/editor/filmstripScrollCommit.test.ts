import { describe, expect, it } from 'vitest'
import { shouldCommitFilmstripScroll } from './filmstripScrollCommit'
import { buildStridePrefix } from './thumbSlotSize'

describe('shouldCommitFilmstripScroll', () => {
  const prefix = buildStridePrefix([1, 1, 1, 1, 1, 1, 1, 1])

  it('is false when scroll stays inside the same window start', () => {
    expect(shouldCommitFilmstripScroll(10, prefix, 0)).toBe(false)
    expect(shouldCommitFilmstripScroll(0, prefix, 0)).toBe(false)
  })

  it('is true when scroll crosses into a later window start', () => {
    // indexFromScrollOffset subtracts an overscan of 4 slots before moving start.
    const far = prefix[6] ?? 0
    expect(shouldCommitFilmstripScroll(far, prefix, 0)).toBe(true)
  })
})
