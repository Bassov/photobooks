import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  addSpread,
  addToGallery,
  applyBookOp,
  applyTemplate,
  checkBookInvariants,
  moveSpread,
  placeAsset,
  placementCountByAsset,
  removeFromGallery,
  removeSpread,
  replaceAsset,
  swapFrames,
  unplaceAsset,
  unplacedAssetIds,
} from '../index'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from '../testing/fixtures'

describe('gallery ops', () => {
  it('adds assets to gallery and assets map', () => {
    const next = addToGallery(makeBook(), ['a', 'b'])
    expect(next.gallery).toEqual(['a', 'b'])
    expect(next.assets).toEqual({ a: {}, b: {} })
  })

  it('addToGallery is idempotent for existing ids', () => {
    const book = addToGallery(makeBook(), ['a'])
    expect(addToGallery(book, ['a'])).toBe(book)
    expect(addToGallery(book, [])).toBe(book)
  })

  it('removeFromGallery cascades placements', () => {
    const book = makeBookWithAsset('photo')
    const next = removeFromGallery(book, 'photo')
    expect(next.gallery).toEqual([])
    expect(next.assets).toEqual({})
    expect(next.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[0]?.crop).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('removeFromGallery no-ops for unknown asset', () => {
    const book = makeBook()
    expect(removeFromGallery(book, 'missing')).toBe(book)
  })
})

describe('placement ops', () => {
  it('places into an empty frame', () => {
    const book = addToGallery(makeBook(), ['a'])
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    if (frameId === undefined) {
      return
    }
    const next = placeAsset(book, 'spread-1', frameId, 'a')
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('a')
    expect(next.spreads[0]?.frames[0]?.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
    })
  })

  it('does not overwrite on place when filled', () => {
    const book = makeBookWithAsset('a')
    const withB = addToGallery(book, ['b'])
    const frameId = withB.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    if (frameId === undefined) {
      return
    }
    const next = placeAsset(withB, 'spread-1', frameId, 'b')
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('a')
    expect(next).toBe(withB)
  })

  it('place rejects assets not in gallery', () => {
    const book = makeBook()
    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      return
    }
    expect(placeAsset(book, 'spread-1', frameId, 'ghost')).toBe(book)
  })

  it('replace overwrites a filled frame', () => {
    const book = addToGallery(makeBookWithAsset('a'), ['b'])
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    if (frameId === undefined) {
      return
    }
    const next = replaceAsset(book, 'spread-1', frameId, 'b')
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('b')
    expect(next.spreads[0]?.frames[0]?.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
    })
  })

  it('replace same asset is a no-op', () => {
    const book = makeBookWithAsset('a')
    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      return
    }
    expect(replaceAsset(book, 'spread-1', frameId, 'a')).toBe(book)
  })

  it('unplace clears asset and crop', () => {
    const book = makeBookWithAsset('a')
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    if (frameId === undefined) {
      return
    }
    const next = unplaceAsset(book, 'spread-1', frameId)
    expect(next.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[0]?.crop).toBeUndefined()
  })

  it('unplace on empty frame is a no-op', () => {
    const book = makeBook()
    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      return
    }
    expect(unplaceAsset(book, 'spread-1', frameId)).toBe(book)
  })

  it('swaps two filled frames including crops', () => {
    const cropA = { zoom: 1, center: { x: 0.2, y: 0.2 } }
    const cropB = { zoom: 2, center: { x: 0.8, y: 0.8 } }
    const book = makeBook({
      assets: { a: {}, b: {} },
      gallery: ['a', 'b'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f1', assetId: 'a', crop: cropA }),
            makeFrame({ id: 'f2', assetId: 'b', crop: cropB }),
          ],
        }),
      ],
    })
    const next = swapFrames(book, 'spread-1', 'f1', 'spread-1', 'f2')
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('b')
    expect(next.spreads[0]?.frames[0]?.crop).toEqual(cropB)
    expect(next.spreads[0]?.frames[1]?.assetId).toBe('a')
    expect(next.spreads[0]?.frames[1]?.crop).toEqual(cropA)
  })

  it('swap moves into an empty target', () => {
    const book = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 'f1',
              assetId: 'a',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
            }),
            makeFrame({ id: 'f2' }),
          ],
        }),
      ],
    })
    const next = swapFrames(book, 'spread-1', 'f1', 'spread-1', 'f2')
    expect(next.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[1]?.assetId).toBe('a')
  })

  it('swap same frame is a no-op', () => {
    const book = makeBookWithAsset('a')
    expect(swapFrames(book, 'spread-1', 'frame-1', 'spread-1', 'frame-1')).toBe(
      book,
    )
  })
})

describe('spread ops', () => {
  it('addSpread appends one-per-page empty frames', () => {
    const book = makeBook()
    const next = addSpread(book, { id: 'new-spread' })
    expect(next.spreads).toHaveLength(2)
    const added = next.spreads[1]
    expect(added?.id).toBe('new-spread')
    expect(added?.templateId).toBe('one-per-page')
    expect(added?.frames).toHaveLength(1)
    expect(added?.frames.every((frame) => frame.assetId === undefined)).toBe(
      true,
    )
    expect(next.spreads[0]).toBe(book.spreads[0])
  })

  it('re-applies a catalog template when addSpread changes page role', () => {
    let book = makeBook({ id: 'session', spreads: [] })
    book = addSpread(book, { id: 'spread-1' })
    book = addSpread(book, { id: 'spread-2' })
    book = addSpread(book, { id: 'spread-3' })
    const first = book.spreads[0]
    const middle = book.spreads[1]
    expect(first?.frames).toHaveLength(1)
    expect(middle?.frames).toHaveLength(2)
    expect(book.spreads[2]?.frames).toHaveLength(1)

    const next = addSpread(book, { id: 'spread-4' })
    expect(next.spreads[0]).toBe(first)
    expect(next.spreads[1]).toBe(middle)
    expect(next.spreads[2]?.templateId).toBe('one-per-page')
    expect(next.spreads[2]?.frames).toHaveLength(2)
    expect(
      next.spreads[2]?.frames.every((frame) => frame.assetId === undefined),
    ).toBe(true)
    expect(next.spreads[3]?.templateId).toBe('one-per-page')
    expect(next.spreads[3]?.frames).toHaveLength(1)
  })

  it('keeps identity when page role changes without a catalog template', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const next = addSpread(book, { id: 'd' })
    expect(next.spreads[0]).toBe(book.spreads[0])
    expect(next.spreads[1]).toBe(book.spreads[1])
    expect(next.spreads[2]).toBe(book.spreads[2])
  })

  it('addSpread inserts at index', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })],
    })
    const next = addSpread(book, { index: 1, id: 'mid' })
    expect(next.spreads.map((spread) => spread.id)).toEqual(['a', 'mid', 'b'])
  })

  it('refuses removing the last spread', () => {
    const book = makeBook()
    expect(removeSpread(book, 'spread-1')).toBe(book)
  })

  it('removes a non-last spread and keeps other identities', () => {
    const a = makeSpread({ id: 'a' })
    const b = makeSpread({ id: 'b' })
    const c = makeSpread({ id: 'c' })
    const book = makeBook({ spreads: [a, b, c] })
    const next = removeSpread(book, 'b')
    expect(next.spreads.map((spread) => spread.id)).toEqual(['a', 'c'])
    expect(next.spreads[0]).toBe(a)
    expect(next.spreads[1]).toBe(c)
  })

  it('moves a spread and keeps unrelated identity', () => {
    const a = makeSpread({ id: 'a' })
    const b = makeSpread({ id: 'b' })
    const c = makeSpread({ id: 'c' })
    const book = makeBook({ spreads: [a, b, c] })
    const next = moveSpread(book, 'c', 0)
    expect(next.spreads.map((spread) => spread.id)).toEqual(['c', 'a', 'b'])
    expect(next.spreads[1]).toBe(a)
    expect(next.spreads[2]).toBe(b)
    expect(next.spreads[0]).toBe(c)
  })

  it('moveSpread no-ops for same index or missing id', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })],
    })
    expect(moveSpread(book, 'a', 0)).toBe(book)
    expect(moveSpread(book, 'missing', 1)).toBe(book)
  })
})

describe('selectors', () => {
  it('reports placement counts and unplaced assets', () => {
    const book = makeBook({
      assets: { a: {}, b: {}, c: {} },
      gallery: ['a', 'b', 'c'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f1', assetId: 'a' }),
            makeFrame({ id: 'f2', assetId: 'a' }),
          ],
        }),
      ],
    })
    expect(placementCountByAsset(book).get('a')).toBe(2)
    expect(placementCountByAsset(book).get('b')).toBeUndefined()
    expect(unplacedAssetIds(book)).toEqual(['b', 'c'])
  })
})

describe('applyBookOp', () => {
  it('dispatches each op type', () => {
    let book = makeBook()
    book = applyBookOp(book, { type: 'addToGallery', assetIds: ['a', 'b'] })
    expect(book.gallery).toEqual(['a', 'b'])

    book = applyBookOp(book, {
      type: 'applyTemplate',
      spreadId: 'spread-1',
      templateId: '2-up',
    })
    expect(book.spreads[0]?.templateId).toBe('2-up')
    expect(book.spreads[0]?.frames).toHaveLength(2)

    const frame0 = book.spreads[0]?.frames[0]?.id
    const frame1 = book.spreads[0]?.frames[1]?.id
    expect(frame0).toBeDefined()
    expect(frame1).toBeDefined()
    if (frame0 === undefined || frame1 === undefined) {
      return
    }

    book = applyBookOp(book, {
      type: 'place',
      spreadId: 'spread-1',
      frameId: frame0,
      assetId: 'a',
    })
    expect(book.spreads[0]?.frames[0]?.assetId).toBe('a')

    book = applyBookOp(book, {
      type: 'replace',
      spreadId: 'spread-1',
      frameId: frame0,
      assetId: 'b',
    })
    expect(book.spreads[0]?.frames[0]?.assetId).toBe('b')

    book = applyBookOp(book, {
      type: 'place',
      spreadId: 'spread-1',
      frameId: frame1,
      assetId: 'a',
    })
    book = applyBookOp(book, {
      type: 'swap',
      spreadIdA: 'spread-1',
      frameIdA: frame0,
      spreadIdB: 'spread-1',
      frameIdB: frame1,
    })
    expect(book.spreads[0]?.frames[0]?.assetId).toBe('a')
    expect(book.spreads[0]?.frames[1]?.assetId).toBe('b')

    book = applyBookOp(book, {
      type: 'unplace',
      spreadId: 'spread-1',
      frameId: frame1,
    })
    expect(book.spreads[0]?.frames[1]?.assetId).toBeUndefined()

    book = applyBookOp(book, { type: 'addSpread', id: 's2' })
    expect(book.spreads).toHaveLength(2)

    book = applyBookOp(book, { type: 'moveSpread', spreadId: 's2', toIndex: 0 })
    expect(book.spreads[0]?.id).toBe('s2')

    book = applyBookOp(book, { type: 'removeSpread', spreadId: 'spread-1' })
    expect(book.spreads.map((spread) => spread.id)).toEqual(['s2'])

    book = applyBookOp(book, { type: 'removeFromGallery', assetId: 'a' })
    expect(book.gallery).toEqual(['b'])
  })
})

test.prop([fc.constantFrom('a', 'b', 'c'), fc.constantFrom(0, 1)], {
  numRuns: 40,
})('ops preserve invariants after place then remove', (assetId, frameIndex) => {
  let book = addToGallery(makeBook(), ['a', 'b', 'c'])
  book = applyTemplate(book, 'spread-1', '2-up')
  const frame = book.spreads[0]?.frames[frameIndex]
  if (frame === undefined) {
    return
  }
  book = placeAsset(book, 'spread-1', frame.id, assetId)
  expect(checkBookInvariants(book).ok).toBe(true)
  book = removeFromGallery(book, assetId)
  expect(checkBookInvariants(book).ok).toBe(true)
  expect(
    book.spreads.every((spread) =>
      spread.frames.every((candidate) => candidate.assetId !== assetId),
    ),
  ).toBe(true)
})
