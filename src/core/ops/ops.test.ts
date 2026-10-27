import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  addSpread,
  addToGallery,
  applyBookOp,
  applyTemplate,
  checkBookInvariants,
  duplicateSpread,
  moveSpread,
  placeAsset,
  placementCountByAsset,
  removeFromGallery,
  removeManyFromGallery,
  removeSpread,
  replaceAsset,
  resolveAddSpreadTemplateId,
  swapFrames,
  TEMPLATE_IDS,
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

  it('removeManyFromGallery drops several assets and cascaded placements once', () => {
    let book = makeBook({
      spreads: [
        makeSpread({
          frames: [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2', z: 1 })],
        }),
      ],
    })
    book = addToGallery(book, ['a', 'b', 'c'])
    book = placeAsset(book, 'spread-1', 'f1', 'a')
    book = placeAsset(book, 'spread-1', 'f2', 'b')
    const next = removeManyFromGallery(book, ['a', 'b', 'missing'])
    expect(next.gallery).toEqual(['c'])
    expect(next.assets).toEqual({ c: {} })
    expect(next.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[1]?.assetId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('removeManyFromGallery no-ops for empty or unknown ids', () => {
    const book = addToGallery(makeBook(), ['keep'])
    expect(removeManyFromGallery(book, [])).toBe(book)
    expect(removeManyFromGallery(book, ['missing'])).toBe(book)
  })

  it('removeManyFromGallery clears an assets-only orphan without a gallery entry', () => {
    const book = makeBook({
      assets: { orphan: {}, keep: {} },
      gallery: ['keep'],
    })
    const next = removeManyFromGallery(book, ['orphan'])
    expect(next).not.toBe(book)
    expect(next.assets).toEqual({ keep: {} })
    expect(next.gallery).toEqual(['keep'])
  })

  it('removeManyFromGallery clears a gallery-only orphan without an assets entry', () => {
    const book = makeBook({
      assets: { keep: {} },
      gallery: ['keep', 'ghost'],
    })
    const next = removeManyFromGallery(book, ['ghost'])
    expect(next.gallery).toEqual(['keep'])
    expect(next.assets).toEqual({ keep: {} })
  })

  it('removeManyFromGallery clears only matching placements and keeps other frames', () => {
    const cropKeep = { zoom: 2, center: { x: 0.25, y: 0.75 } }
    const cropDrop = { zoom: 1.5, center: { x: 0.1, y: 0.9 } }
    const empty = makeFrame({ id: 'empty', z: 2 })
    const book = makeBook({
      assets: { keep: {}, drop: {} },
      gallery: ['keep', 'drop'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 'f-keep',
              assetId: 'keep',
              crop: cropKeep,
            }),
            makeFrame({
              id: 'f-drop',
              assetId: 'drop',
              crop: cropDrop,
              z: 1,
            }),
            empty,
          ],
        }),
        makeSpread({
          id: 'untouched',
          frames: [makeFrame({ id: 'f-other' })],
        }),
      ],
    })
    const untouched = book.spreads[1]
    const next = removeManyFromGallery(book, ['drop'])
    expect(next.gallery).toEqual(['keep'])
    expect(next.assets).toEqual({ keep: {} })
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('keep')
    expect(next.spreads[0]?.frames[0]?.crop).toEqual(cropKeep)
    expect(next.spreads[0]?.frames[1]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[1]?.crop).toBeUndefined()
    expect(next.spreads[0]?.frames[2]).toBe(empty)
    expect(next.spreads[1]).toBe(untouched)
  })
})

describe('placement ops', () => {
  it('places into an empty frame', () => {
    const book = addToGallery(makeBook(), ['a'])
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    assert(frameId !== undefined)
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
    assert(frameId !== undefined)
    const next = placeAsset(withB, 'spread-1', frameId, 'b')
    expect(next.spreads[0]?.frames[0]?.assetId).toBe('a')
    expect(next).toBe(withB)
  })

  it('place rejects assets not in gallery', () => {
    const book = makeBook()
    const frameId = book.spreads[0]?.frames[0]?.id
    assert(frameId !== undefined)
    expect(placeAsset(book, 'spread-1', frameId, 'ghost')).toBe(book)
  })

  it('replace overwrites a filled frame', () => {
    const book = addToGallery(makeBookWithAsset('a'), ['b'])
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    assert(frameId !== undefined)
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
    assert(frameId !== undefined)
    expect(replaceAsset(book, 'spread-1', frameId, 'a')).toBe(book)
  })

  it('unplace clears asset and crop', () => {
    const book = makeBookWithAsset('a')
    const frameId = book.spreads[0]?.frames[0]?.id
    expect(frameId).toBeDefined()
    assert(frameId !== undefined)
    const next = unplaceAsset(book, 'spread-1', frameId)
    expect(next.spreads[0]?.frames[0]?.assetId).toBeUndefined()
    expect(next.spreads[0]?.frames[0]?.crop).toBeUndefined()
  })

  it('unplace on empty frame is a no-op', () => {
    const book = makeBook()
    const frameId = book.spreads[0]?.frames[0]?.id
    assert(frameId !== undefined)
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

  it('addSpread copies a provided 4-grid template', () => {
    const book = makeBook()
    const next = addSpread(book, { id: 'grid-spread', templateId: '4-grid' })
    const added = next.spreads[1]
    expect(added?.templateId).toBe('4-grid')
    expect(added?.frames).toHaveLength(4)
    expect(added?.frames.every((frame) => frame.assetId === undefined)).toBe(
      true,
    )
  })

  it('addSpread falls back to one-per-page for an invalid templateId', () => {
    const book = makeBook()
    const next = addSpread(book, {
      id: 'fallback-spread',
      templateId: 'not-a-template',
    })
    expect(next.spreads[1]?.templateId).toBe('one-per-page')
    expect(next.spreads[1]?.frames).toHaveLength(1)
  })

  it('resolveAddSpreadTemplateId validates catalog ids', () => {
    expect(resolveAddSpreadTemplateId(undefined)).toBe('one-per-page')
    expect(resolveAddSpreadTemplateId('')).toBe('one-per-page')
    expect(resolveAddSpreadTemplateId('not-a-template')).toBe('one-per-page')
    expect(resolveAddSpreadTemplateId('4-grid')).toBe('4-grid')
    expect(resolveAddSpreadTemplateId('2-up')).toBe('2-up')
    expect(resolveAddSpreadTemplateId('full-bleed')).toBe('full-bleed')
    expect(resolveAddSpreadTemplateId('one-per-page')).toBe('one-per-page')
  })

  it('applyBookOp forwards templateId on addSpread', () => {
    const book = makeBook()
    const next = applyBookOp(book, {
      type: 'addSpread',
      id: 'via-op',
      templateId: '2-up',
    })
    expect(next.spreads[1]?.templateId).toBe('2-up')
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

  it('keeps identity when a non-catalog template id changes page role', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c', templateId: 'not-a-template' }),
      ],
    })
    const next = addSpread(book, { id: 'd' })
    expect(next.spreads[2]).toBe(book.spreads[2])
  })

  it('keeps a hand-edited catalog spread when its page count stays the same', () => {
    let book = makeBook({ id: 'session', spreads: [] })
    book = addSpread(book, { id: 'spread-1' })
    book = addSpread(book, { id: 'spread-2' })
    book = addSpread(book, { id: 'spread-3' })
    const first = book.spreads[0]
    const middle = book.spreads[1]
    const last = book.spreads[2]
    const frame = middle?.frames[0]
    assert(
      first !== undefined &&
        middle !== undefined &&
        last !== undefined &&
        frame !== undefined,
      'expected session spreads',
    )
    const editedMiddle = {
      ...middle,
      frames: [
        { ...frame, rect: { ...frame.rect, width: 1 } },
        ...middle.frames.slice(1),
      ],
    }
    const next = addSpread(
      { ...book, spreads: [first, editedMiddle, last] },
      { id: 'spread-4' },
    )
    expect(next.spreads[1]?.frames[0]?.rect.width).toBe(1)
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

  it('removeSpread no-ops for a missing id when more than one spread exists', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })],
    })
    expect(removeSpread(book, 'missing')).toBe(book)
  })

  it('addSpread allocates a non-colliding id when spread-N is taken', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'spread-2' })],
    })
    const next = addSpread(book)
    expect(next.spreads).toHaveLength(2)
    expect(next.spreads[1]?.id).not.toBe('spread-2')
    expect(next.spreads[1]?.id.startsWith('spread-')).toBe(true)
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

  it('duplicates a spread right after the source with a fresh id', () => {
    const a = makeSpread({ id: 'a', frames: [makeFrame({ id: 'f1' })] })
    const b = makeSpread({ id: 'b' })
    const book = makeBook({ spreads: [a, b] })
    const next = duplicateSpread(book, 'a', { id: 'a-copy' })
    expect(next.spreads.map((spread) => spread.id)).toEqual([
      'a',
      'a-copy',
      'b',
    ])
    expect(next.spreads[1]?.frames.map((frame) => frame.id)).toEqual(['f1'])
    expect(next.spreads[1]?.frames[0]).not.toBe(a.frames[0])
    expect(next.spreads[0]).toBe(a)
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('duplicateSpread allocates an id and no-ops for a missing spread', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'spread-2' }), makeSpread({ id: 'b' })],
    })
    const next = applyBookOp(book, { type: 'duplicateSpread', spreadId: 'b' })
    expect(next.spreads).toHaveLength(3)
    expect(new Set(next.spreads.map((spread) => spread.id)).size).toBe(3)
    expect(duplicateSpread(book, 'missing')).toBe(book)
    const named = applyBookOp(book, {
      type: 'duplicateSpread',
      spreadId: 'b',
      id: 'chosen',
    })
    expect(named.spreads.map((spread) => spread.id)).toEqual([
      'spread-2',
      'b',
      'chosen',
    ])
    expect(next.spreads[2]?.id).not.toBe('chosen')
  })

  it('moveSpread re-lays a templated spread whose page count changes and keeps its photos', () => {
    const base = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const first = applyTemplate(base, 'a', 'one-per-page')
    const before = first.spreads[0]
    const moved = moveSpread(first, 'a', 1)
    const after = moved.spreads[1]
    expect(after?.id).toBe('a')
    expect(after?.templateId).toBe('one-per-page')
    expect(after?.frames.length).toBeGreaterThan(before?.frames.length ?? 0)
  })

  it('applyTemplate with fewer frames keeps the first photos in order and unplaces the rest', () => {
    let book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    book = addToGallery(book, ['p1', 'p2', 'p3', 'p4'])
    book = applyTemplate(book, 'b', '4-grid')
    const frames = book.spreads[1]?.frames ?? []
    expect(frames).toHaveLength(4)
    frames.forEach((frame, i) => {
      book = placeAsset(book, 'b', frame.id, `p${String(i + 1)}`)
    })
    const next = applyTemplate(book, 'b', '2-up')
    const placed = (next.spreads[1]?.frames ?? []).map((f) => f.assetId)
    expect(placed).toEqual(['p1', 'p2'])
    expect(unplacedAssetIds(next)).toEqual(['p3', 'p4'])
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
    assert(frame0 !== undefined)
    assert(frame1 !== undefined)

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

    book = applyBookOp(book, { type: 'setTitle', title: 'Summer' })
    expect(book.title).toBe('Summer')
    const sameTitle = applyBookOp(book, { type: 'setTitle', title: 'Summer' })
    expect(sameTitle).toBe(book)

    book = applyBookOp(book, {
      type: 'addSpread',
      index: 0,
      id: 'front',
    })
    expect(book.spreads[0]?.id).toBe('front')
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

test.prop([fc.constantFrom(...TEMPLATE_IDS)], { numRuns: 40 })(
  'addSpread with any valid template keeps invariants',
  (templateId) => {
    const book = makeBook()
    const next = addSpread(book, { id: 'prop-spread', templateId })
    expect(checkBookInvariants(next).ok).toBe(true)
    expect(next.spreads[1]?.templateId).toBe(templateId)
  },
)
