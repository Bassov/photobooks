import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { bookHasAnyPlacement, placementCountByAsset } from './placements'

describe('bookHasAnyPlacement', () => {
  it('is false when no frame has an assetId', () => {
    const book = makeBook({
      gallery: ['a'],
      spreads: [makeSpread({ frames: [makeFrame({ id: 'f0' })] })],
    })
    expect(bookHasAnyPlacement(book)).toBe(false)
    expect(placementCountByAsset(book).size).toBe(0)
  })

  it('is true when any frame has an assetId even if others are empty', () => {
    const book = makeBook({
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f0', assetId: 'a' }),
            makeFrame({ id: 'f1' }),
          ],
        }),
      ],
    })
    expect(bookHasAnyPlacement(book)).toBe(true)
  })
})
