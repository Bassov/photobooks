import { describe, expect, it } from 'vitest'

import { tryCacheKeyFromAsset } from '../assets/cacheKey'
import { defaultCoverStyle } from '../core/cover'
import { makeBook } from '../core/testing/fixtures'
import { bookSummaryFromBook } from './bookSummary'

const asset = {
  sourceRootId: 'root-1',
  relativePath: 'a/fog.jpg',
  byteSize: 10,
  mtimeMs: 20,
}

describe('bookSummaryFromBook cover', () => {
  it('exposes the cover-front cache key and crop center', () => {
    const book = makeBook({
      assets: { a1: asset },
      gallery: ['a1'],
      cover: {
        style: defaultCoverStyle(),
        front: {
          text: 'T',
          assetId: 'a1',
          crop: { zoom: 1, center: { x: 0.3, y: 0.4 } },
        },
        spine: { text: '' },
        back: { text: '' },
      },
    })
    const summary = bookSummaryFromBook(book)
    expect(summary.coverCacheKey).toBe(tryCacheKeyFromAsset(asset))
    expect(summary.coverCenter).toEqual({ x: 0.3, y: 0.4 })
  })

  it('omits the center without a crop and everything without identity', () => {
    const noCrop = makeBook({
      assets: { a1: asset },
      cover: {
        style: defaultCoverStyle(),
        front: { text: 'T', assetId: 'a1' },
        spine: { text: '' },
        back: { text: '' },
      },
    })
    const withKey = bookSummaryFromBook(noCrop)
    expect(withKey.coverCacheKey).toBeDefined()
    expect('coverCenter' in withKey).toBe(false)

    const noIdentity = makeBook({
      assets: { a1: {} },
      cover: {
        style: defaultCoverStyle(),
        front: { text: 'T', assetId: 'a1' },
        spine: { text: '' },
        back: { text: '' },
      },
    })
    const bare = bookSummaryFromBook(noIdentity)
    expect('coverCacheKey' in bare).toBe(false)
    expect('coverCenter' in bare).toBe(false)
  })
})
