import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import {
  bookHasAnyPlacement,
  placementCountByAsset,
  unplacedAssetIds,
} from './placements'

describe('placements on the cover and endpapers', () => {
  it('counts cover panels and endpapers like frames', () => {
    const book = makeBook({
      gallery: ['a', 'b', 'c'],
      spreads: [
        makeSpread({ frames: [makeFrame({ id: 'f0', assetId: 'a' })] }),
      ],
      cover: {
        front: { text: '', assetId: 'a' },
        spine: { text: '' },
        back: { text: '', assetId: 'b' },
      },
      endpapers: { front: { assetId: 'c' }, back: {} },
    })
    const counts = placementCountByAsset(book)
    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
    expect(counts.get('c')).toBe(1)
    expect(unplacedAssetIds(book)).toEqual([])
  })

  it('counts the spine panel and back endpaper too', () => {
    const book = makeBook({
      gallery: ['a', 'b'],
      cover: {
        front: { text: '' },
        spine: { text: '', assetId: 'a' },
        back: { text: '' },
      },
      endpapers: { front: {}, back: { assetId: 'b' } },
    })
    expect(placementCountByAsset(book).get('a')).toBe(1)
    expect(placementCountByAsset(book).get('b')).toBe(1)
  })

  it('keeps bookHasAnyPlacement about frames only', () => {
    const book = makeBook({
      gallery: ['a'],
      cover: {
        front: { text: '', assetId: 'a' },
        spine: { text: '' },
        back: { text: '' },
      },
    })
    expect(bookHasAnyPlacement(book)).toBe(false)
  })
})

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
