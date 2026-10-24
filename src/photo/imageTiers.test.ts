import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  IMAGE_TIERS,
  selectImageTier,
  WORKING_PREVIEW_EDGE,
} from './imageTiers'

describe('selectImageTier', () => {
  it('always returns the working preview edge', () => {
    expect(selectImageTier()).toBe(WORKING_PREVIEW_EDGE)
  })

  it('exposes a single-tier ladder', () => {
    expect(IMAGE_TIERS).toEqual([WORKING_PREVIEW_EDGE])
  })
})

test.prop([fc.constant(null)], { numRuns: 20 })(
  'selectImageTier is always the working preview',
  () => {
    expect(selectImageTier()).toBe(WORKING_PREVIEW_EDGE)
  },
)
