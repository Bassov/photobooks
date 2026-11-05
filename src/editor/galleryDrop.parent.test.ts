import { describe, expect, it } from 'vitest'
import { applyBookOp } from '../core'
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

  it('offers a local copy as a drop target below every own frame', () => {
    const book = applyBookOp(
      makeBook({
        parents: [
          {
            id: 'p1',
            name: 'Master A',
            frames: [makeFrame({ id: 'logo', z: 99 })],
            guides: [],
          },
        ],
        defaultParentId: 'p1',
        spreads: [
          makeSpread({ id: 's1', frames: [makeFrame({ id: 'own', z: 0 })] }),
        ],
      }),
      {
        type: 'overrideParentFrame',
        spreadId: 's1',
        parentFrameId: 'logo',
        id: 'copy-1',
      },
    )

    const [spread] = dropSpreadsFromBook(book, {
      pxPerMm: 1,
      stridePx: 400,
      worldWidthPx: 400,
    })

    const items = spread?.items ?? []
    expect(items.map((item) => item.frameId)).toEqual(['copy-1', 'own'])
    const [copy, own] = items
    expect(copy && own && copy.z < own.z).toBe(true)
  })

  it('never offers a text frame: a drop falls through to the photo frame below', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          id: 's1',
          frames: [
            makeFrame({ id: 'photo' }),
            {
              id: 'label',
              rect: { x: 0, y: 0, width: 60, height: 14 },
              z: 2,
              kind: 'text',
            },
          ],
        }),
      ],
    })

    const [spread] = dropSpreadsFromBook(book, {
      pxPerMm: 1,
      stridePx: 400,
      worldWidthPx: 400,
    })

    expect(spread?.items.map((item) => item.frameId)).toEqual(['photo'])
  })
})
