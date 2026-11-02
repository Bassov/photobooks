import { describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { dropSpreadsFromBook } from './galleryDrop'

describe('dropSpreadsFromBook parent layer', () => {
  it('offers only the spread’s own frames as drop targets, never parent items', () => {
    const book = makeBook({
      parents: [
        {
          id: 'p1',
          name: 'Master A',
          frames: [makeFrame({ id: 'logo', assetId: 'a1' })],
          guides: [],
        },
      ],
      defaultParentId: 'p1',
      spreads: [makeSpread({ id: 's1', frames: [makeFrame({ id: 'own' })] })],
    })

    const [spread] = dropSpreadsFromBook(book, {
      pxPerMm: 1,
      stridePx: 400,
      worldWidthPx: 400,
    })

    expect(spread?.items.map((item) => item.frameId)).toEqual(['own'])
  })
})
