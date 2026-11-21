import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  addToGallery,
  applyBookOp,
  applyTemplate,
  checkBookInvariants,
  fillBook,
  fillSpread,
  insertSpreadWithAssets,
  pageLabel,
  placeAsset,
  planFillBook,
  type Book,
  type Frame,
  type SavedTemplate,
} from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

function gridBook(assetIds: readonly string[]): Book {
  return applyTemplate(addToGallery(makeBook(), assetIds), 'spread-1', '4-grid')
}

function placed(book: Book, spreadIndex = 0): (string | undefined)[] {
  return (book.spreads[spreadIndex]?.frames ?? []).map((frame) => frame.assetId)
}

describe('fillSpread', () => {
  it('fills empty frames in the given order', () => {
    const book = gridBook(['a', 'b', 'c', 'd'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['a', 'b', 'c', 'd'])
    expect(placed(next)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores photos beyond free frames', () => {
    const book = gridBook(['a', 'b', 'c', 'd', 'e'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(placed(next)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('replaces a filled target and fills the rest', () => {
    let book = gridBook(['a', 'b', 'c', 'd', 'e'])
    const frames = book.spreads[0]?.frames ?? []
    book = placeAsset(book, 'spread-1', frames[1]?.id ?? '', 'e')
    const next = fillSpread(book, 'spread-1', frames[1]?.id ?? '', [
      'a',
      'b',
      'c',
    ])
    expect(placed(next)).toEqual(['b', 'a', 'c', undefined])
  })

  it('skips unknown and duplicate ids', () => {
    const book = gridBook(['a', 'b'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['x', 'a', 'a', 'b'])
    expect(placed(next)).toEqual(['a', 'b', undefined, undefined])
  })

  it('returns the same book for unknown target or no usable photos', () => {
    const book = gridBook(['a'])
    expect(fillSpread(book, 'nope', 'x', ['a'])).toBe(book)
    expect(fillSpread(book, 'spread-1', 'nope', ['a'])).toBe(book)
    expect(fillSpread(book, 'spread-1', 'frame-1', ['zzz'])).toBe(book)
  })

  test.prop([fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'q'))])(
    'never changes the frame count and keeps invariants',
    (ids) => {
      const book = gridBook(['a', 'b', 'c', 'd', 'e'])
      const frameId = book.spreads[0]?.frames[0]?.id ?? ''
      const next = fillSpread(book, 'spread-1', frameId, ids)
      expect(next.spreads[0]?.frames.length).toBe(4)
      expect(checkBookInvariants(next)).toEqual({ ok: true })
    },
  )
})

const DEFAULT_CROP = { zoom: 1, center: { x: 0.5, y: 0.5 } }

describe('fillSpread details', () => {
  it('gives placed frames the default crop', () => {
    const book = gridBook(['a'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['a'])
    expect(next.spreads[0]?.frames[0]?.crop).toEqual(DEFAULT_CROP)
  })

  it('keeps filled frames that are not the target', () => {
    let book = gridBook(['a', 'b', 'c'])
    const frames = book.spreads[0]?.frames ?? []
    book = placeAsset(book, 'spread-1', frames[2]?.id ?? '', 'c')
    const next = fillSpread(book, 'spread-1', frames[0]?.id ?? '', ['a', 'b'])
    expect(placed(next)).toEqual(['a', 'b', 'c', undefined])
  })

  it('keeps a frame (and its crop) when the target already holds the photo', () => {
    let book = gridBook(['a'])
    const frame = book.spreads[0]?.frames[0]
    book = placeAsset(book, 'spread-1', frame?.id ?? '', 'a')
    const next = fillSpread(book, 'spread-1', frame?.id ?? '', ['a'])
    expect(next.spreads[0]?.frames[0]).toBe(book.spreads[0]?.frames[0])
  })

  it('only touches the named spread', () => {
    const base = gridBook(['a', 'b'])
    const two = applyBookOp(base, { type: 'addSpread', templateId: '4-grid' })
    const frameId = two.spreads[1]?.frames[0]?.id ?? ''
    const next = fillSpread(two, two.spreads[1]?.id ?? '', frameId, ['a', 'b'])
    expect(placed(next, 0)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(placed(next, 1).slice(0, 2)).toEqual(['a', 'b'])
  })

  it('skips locked frames and refuses a locked target', () => {
    const book = gridBook(['a', 'b', 'c'])
    const frames = book.spreads[0]?.frames ?? []
    const locked = applyBookOp(book, {
      type: 'setFrameLocked',
      spreadId: 'spread-1',
      frameId: frames[1]?.id ?? '',
      locked: true,
    })
    const next = fillSpread(locked, 'spread-1', frames[0]?.id ?? '', [
      'a',
      'b',
      'c',
    ])
    expect(placed(next)).toEqual(['a', undefined, 'b', 'c'])
    expect(next.spreads[0]?.frames[1]).toBe(locked.spreads[0]?.frames[1])
    expect(fillSpread(locked, 'spread-1', frames[1]?.id ?? '', ['a'])).toBe(
      locked,
    )
  })
})

describe('insertSpreadWithAssets', () => {
  const portrait = { widthPx: 2000, heightPx: 3000 }

  it('reads stored dims as already oriented (no second EXIF swap)', () => {
    let book = addToGallery(makeBook(), ['l1', 'l2'])
    book = {
      ...book,
      assets: {
        l1: { widthPx: 3000, heightPx: 2000, orientation: 6 },
        l2: { widthPx: 3000, heightPx: 2000, orientation: 8 },
      },
    }
    expect(
      insertSpreadWithAssets(book, 1, ['l1', 'l2'], []).spreads[1]?.templateId,
    ).not.toBe('two-portraits')
  })

  it('uses photo size (missing size) to pick the template', () => {
    let book = addToGallery(makeBook(), ['p1', 'p2', 'w', 'h'])
    book = {
      ...book,
      assets: {
        p1: { widthPx: 2000, heightPx: 3000, orientation: 6 },
        p2: { widthPx: 2000, heightPx: 3000, orientation: 6 },
        w: { widthPx: 3000 },
        h: { heightPx: 3000 },
      },
    }
    expect(
      insertSpreadWithAssets(book, 1, ['p1', 'p2'], []).spreads[1]?.templateId,
    ).toBe('two-portraits')
    // Missing width or height counts as square, which matches every slot.
    const unknown = insertSpreadWithAssets(book, 1, ['w', 'h'], [])
    expect(unknown.spreads[1]?.templateId).toBe('two-portraits')
    expect(placed(unknown, 1)).toEqual(['w', 'h'])
  })

  it('clamps the insert index into the book', () => {
    const book = addToGallery(makeBook(), ['a'])
    const low = insertSpreadWithAssets(book, -3, ['a'], [])
    expect(low.spreads).toHaveLength(2)
    expect(placed(low, 0)).toContain('a')
    expect(placed(low, 1)).toEqual([undefined])
    const high = insertSpreadWithAssets(book, 99, ['a'], [])
    expect(placed(high, 1)).toContain('a')
  })

  it('gives placed frames the default crop', () => {
    const book = addToGallery(makeBook(), ['a'])
    const next = insertSpreadWithAssets(book, 1, ['a'], [])
    expect(next.spreads[1]?.frames[0]?.crop).toEqual(DEFAULT_CROP)
  })

  it('inserts a spread at the index with the best template and photos in order', () => {
    let book = addToGallery(makeBook(), ['p1', 'p2'])
    book = {
      ...book,
      assets: { p1: portrait, p2: portrait },
    }
    const next = insertSpreadWithAssets(book, 1, ['p1', 'p2'], [])
    expect(next.spreads).toHaveLength(2)
    expect(next.spreads[1]?.templateId).toBe('two-portraits')
    expect(placed(next, 1)).toEqual(['p1', 'p2'])
  })

  it('leaves overflow photos unplaced', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `p${String(i)}`)
    const book = addToGallery(makeBook(), ids)
    const next = insertSpreadWithAssets(book, 0, ids, [])
    const filled = placed(next, 0).filter((id) => id !== undefined)
    expect(filled.length).toBeLessThan(ids.length)
    expect(filled).toEqual(ids.slice(0, filled.length))
  })

  describe('with saved templates', () => {
    const landscape = { widthPx: 3000, heightPx: 2000 }
    const ids = ['p1', 'l1', 'p2', 'l2', 'p3']
    const tall = { x: 0, y: 0, w: 5, h: 90 }
    const wide = { x: 0, y: 0, w: 90, h: 5 }
    const fit: SavedTemplate = {
      id: 'user-fit',
      name: 'Fit',
      pages: 2,
      slots: [tall, wide, tall, wide, tall],
    }

    function mixedBook(): Book {
      const book = addToGallery(
        makeBook({
          spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })],
        }),
        ids,
      )
      return {
        ...book,
        assets: {
          p1: portrait,
          l1: landscape,
          p2: portrait,
          l2: landscape,
          p3: portrait,
        },
      }
    }

    it('applies a saved layout that fits strictly better and fills it in order', () => {
      const next = applyBookOp(mixedBook(), {
        type: 'insertSpreadWithAssets',
        index: 1,
        assetIds: ids,
        templates: [fit],
      })
      expect(next.spreads[1]?.templateId).toBe('user-fit')
      expect(placed(next, 1)).toEqual(ids)
      expect(checkBookInvariants(next)).toEqual({ ok: true })
    })

    it('skips a saved layout of another page count', () => {
      const page: SavedTemplate = { ...fit, id: 'user-page', pages: 1 }
      const kept = insertSpreadWithAssets(mixedBook(), 1, ids, [page])
      expect(kept.spreads[1]?.templateId).not.toBe('user-page')
      expect(placed(kept, 1).filter((id) => id !== undefined)).toEqual(ids)
      const next = insertSpreadWithAssets(mixedBook(), 1, ids, [page, fit])
      expect(next.spreads[1]?.templateId).toBe('user-fit')
    })
  })

  it('returns the same book when no photo is usable', () => {
    const book = makeBook()
    expect(insertSpreadWithAssets(book, 0, ['nope'], [])).toBe(book)
  })

  it('is reachable through applyBookOp', () => {
    const book = addToGallery(makeBook(), ['a'])
    const next = applyBookOp(book, {
      type: 'insertSpreadWithAssets',
      index: 5,
      assetIds: ['a'],
      templates: [],
    })
    expect(next.spreads).toHaveLength(2)
    expect(placed(next, 1)).toContain('a')
    const frameId = next.spreads[1]?.frames[0]?.id ?? ''
    const filled = applyBookOp(book, {
      type: 'fillSpread',
      spreadId: 'spread-1',
      frameId: book.spreads[0]?.frames[0]?.id ?? frameId,
      assetIds: ['a'],
    })
    expect(placed(filled)).toEqual(['a'])
  })
})

const ids12 = Array.from({ length: 12 }, (_, i) => `p${String(i + 1)}`)

/** A new book: pages `1`, `2–3`, `4` with 1, 2 and 1 empty frames. */
function newBook(ids: readonly string[]): Book {
  let book = addToGallery(
    makeBook({
      spreads: ['s1', 's2', 's3'].map((id) => makeSpread({ id, frames: [] })),
    }),
    ids,
  )
  for (const id of ['s1', 's2', 's3']) {
    book = applyTemplate(book, id, 'one-per-page')
  }
  return book
}

/** Photos of every spread, frames in array order. */
function photos(book: Book): (string | undefined)[][] {
  return book.spreads.map((spread) =>
    spread.frames.map((frame) => frame.assetId),
  )
}

/** A book with a handmade middle spread between two frameless single pages. */
function handBook(frames: Frame[], ids: readonly string[] = ['a', 'b']): Book {
  return addToGallery(
    makeBook({
      spreads: [
        makeSpread({ id: 'first', frames: [] }),
        makeSpread({ id: 'mid', frames }),
        makeSpread({ id: 'last', frames: [] }),
      ],
    }),
    ids,
  )
}

function assetOf(book: Book, frameId: string): string | undefined {
  return book.spreads
    .flatMap((spread) => spread.frames)
    .find((frame) => frame.id === frameId)?.assetId
}

describe('fillBook', () => {
  it('fills a new book with 12 photos up to page 12, the last photo on the last page', () => {
    const book = newBook(ids12)
    expect(planFillBook(book, ids12, 120)).toEqual({
      intoFrames: 4,
      onNewSpreads: 8,
      newSpreads: 4,
      leftover: 0,
      pagesBefore: 4,
      pagesAfter: 12,
      maxPages: 120,
    })
    const next = fillBook(book, ids12, [], 120)
    const count = next.spreads.length
    expect(next.spreads.map((_, i) => pageLabel(i, count))).toEqual([
      '1',
      '2–3',
      '4–5',
      '6–7',
      '8–9',
      '10–11',
      '12',
    ])
    // E (pages 1–3) → new spreads (4–11) → L (page 12), in order.
    expect(photos(next).flat()).toEqual(ids12)
    expect(photos(next).at(-1)).toEqual(['p12'])
    expect(next.spreads.map((spread) => spread.id).slice(0, 2)).toEqual([
      's1',
      's2',
    ])
    expect(next.spreads.at(-1)?.id).toBe('s3')
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('reads a spread left page → right page, top (to 1 mm) → bottom, left → right', () => {
    const book = handBook(
      [
        makeFrame({
          id: 'right',
          rect: { x: 300, y: 0, width: 50, height: 50 },
        }),
        makeFrame({
          id: 'low',
          rect: { x: 10, y: 200, width: 50, height: 50 },
        }),
        makeFrame({ id: 'b', rect: { x: 150, y: 9.6, width: 50, height: 50 } }),
        makeFrame({ id: 'a', rect: { x: 10, y: 10.4, width: 50, height: 50 } }),
      ],
      ['p1', 'p2', 'p3', 'p4'],
    )
    const next = fillBook(book, ['p1', 'p2', 'p3', 'p4'], [], 120)
    expect(['a', 'b', 'low', 'right'].map((id) => assetOf(next, id))).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ])
    expect(next.spreads).toHaveLength(3)
  })

  it('skips locked, text, filled and master items and keeps them ===', () => {
    const master = makeFrame({ id: 'm' })
    const base = handBook(
      [
        makeFrame({ id: 'locked', locked: true }),
        makeFrame({ id: 'text', kind: 'text' }),
        makeFrame({
          id: 'filled',
          assetId: 'x',
          rect: { x: 0, y: 0, width: 9, height: 9 },
        }),
        makeFrame({ id: 'free', rect: { x: 0, y: 150, width: 9, height: 9 } }),
      ],
      ['x', 'a', 'b'],
    )
    const book: Book = {
      ...base,
      parents: [{ id: 'parent', name: 'P', frames: [master], guides: [] }],
      defaultParentId: 'parent',
    }
    const next = fillBook(book, ['a'], [], 120)
    expect(assetOf(next, 'free')).toBe('a')
    const before = book.spreads[1]?.frames ?? []
    const after = next.spreads[1]?.frames ?? []
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3))
    after.slice(0, 3).forEach((frame, i) => {
      expect(frame).toBe(before[i])
    })
    expect(next.parents).toBe(book.parents)
    expect(next.spreads).toHaveLength(3)
  })

  it('never touches the cover, endpapers or master items', () => {
    const book = newBook(ids12)
    const next = fillBook(book, ids12, [], 120)
    expect(next.cover).toBe(book.cover)
    expect(next.endpapers).toBe(book.endpapers)
    expect(next.parents).toBe(book.parents)
  })

  it('does not re-place photos used anywhere, cover-only included', () => {
    let book = newBook(['cov', 'end', 'used', 'a'])
    book = placeAsset(book, 's3', book.spreads[2]?.frames[0]?.id ?? '', 'used')
    book = {
      ...book,
      cover: { ...book.cover, front: { ...book.cover.front, assetId: 'cov' } },
      endpapers: { ...book.endpapers, back: { assetId: 'end' } },
    }
    const ids = ['cov', 'end', 'used', 'nope', 'a', 'a']
    expect(planFillBook(book, ids, 120)).toMatchObject({
      intoFrames: 1,
      leftover: 0,
    })
    expect(photos(fillBook(book, ids, [], 120))).toEqual([
      ['a'],
      [undefined, undefined],
      ['used'],
    ])
  })

  it('puts an odd last photo on a spread of its own', () => {
    const ids = ids12.slice(0, 7)
    const book = newBook(ids)
    expect(planFillBook(book, ids, 120)).toMatchObject({
      intoFrames: 4,
      onNewSpreads: 3,
      newSpreads: 2,
      pagesAfter: 8,
    })
    const next = fillBook(book, ids, [], 120)
    expect(photos(next).map((list) => list.filter(Boolean).length)).toEqual([
      1, 2, 2, 1, 1,
    ])
    expect(photos(next)[3]).toContain('p6')
    expect(photos(next).at(-1)).toEqual(['p7'])
  })

  it('stops at the page limit: the tail stays unplaced', () => {
    const book = newBook(ids12)
    expect(planFillBook(book, ids12, 9)).toEqual({
      intoFrames: 4,
      onNewSpreads: 4,
      newSpreads: 2,
      leftover: 4,
      pagesBefore: 4,
      pagesAfter: 8,
      maxPages: 9,
    })
    const next = fillBook(book, ids12, [], 9)
    expect(photos(next).flat()).toEqual(ids12.slice(0, 8))
  })

  it('adds no spread when the book is already past the limit', () => {
    const book = newBook(ids12)
    expect(planFillBook(book, ids12, 2)).toMatchObject({
      newSpreads: 0,
      onNewSpreads: 0,
      intoFrames: 4,
      leftover: 8,
      pagesAfter: 4,
    })
    expect(photos(fillBook(book, ids12, [], 2))).toEqual([
      ['p1'],
      ['p2', 'p3'],
      ['p4'],
    ])
  })

  it('fills frames before the last page first and adds no spread when the frames suffice', () => {
    const ids = ['p1', 'p2']
    const book = newBook(ids)
    expect(planFillBook(book, ids, 120)).toMatchObject({
      intoFrames: 2,
      newSpreads: 0,
      leftover: 0,
      pagesAfter: 4,
    })
    expect(photos(fillBook(book, ids, [], 120))).toEqual([
      ['p1'],
      ['p2', undefined],
      [undefined],
    ])
  })

  it('puts new spreads after the only spread of a one-spread book', () => {
    const book = applyTemplate(
      addToGallery(makeBook(), ['a', 'b', 'c']),
      'spread-1',
      'one-per-page',
    )
    expect(planFillBook(book, ['a', 'b', 'c'], 120)).toMatchObject({
      intoFrames: 0,
      onNewSpreads: 3,
      newSpreads: 2,
      pagesBefore: 1,
      pagesAfter: 4,
    })
    const next = fillBook(book, ['a', 'b', 'c'], [], 120)
    expect(next.spreads[0]?.id).toBe('spread-1')
    expect(photos(next)[0]).toEqual([undefined])
    expect(photos(next).flat().filter(Boolean)).toEqual(['a', 'b', 'c'])
  })

  it('fills both single pages of a two-spread book', () => {
    let book = addToGallery(
      makeBook({
        spreads: ['s1', 's2'].map((id) => makeSpread({ id, frames: [] })),
      }),
      ['a', 'b'],
    )
    book = applyTemplate(
      applyTemplate(book, 's1', 'one-per-page'),
      's2',
      'one-per-page',
    )
    expect(planFillBook(book, ['a', 'b'], 2)).toMatchObject({
      intoFrames: 2,
      leftover: 0,
    })
    expect(photos(fillBook(book, ['a', 'b'], [], 2))).toEqual([['a'], ['b']])
  })

  it('returns the same book when nothing is placeable', () => {
    const book = newBook(['a'])
    expect(fillBook(book, ['nope'], [], 120)).toBe(book)
    expect(fillBook(book, [], [], 120)).toBe(book)
  })

  it('is reachable through applyBookOp with saved layouts', () => {
    const landscape = { widthPx: 3000, heightPx: 2000 }
    const base = newBook(ids12)
    const book: Book = {
      ...base,
      // Portrait pages: builtin page-wide slots no longer suit landscapes.
      settings: { ...base.settings, trim: { widthMm: 200, heightMm: 300 } },
      assets: Object.fromEntries(ids12.map((id) => [id, landscape])),
    }
    const wide = { x: 0, y: 0, w: 90, h: 5 }
    const saved: SavedTemplate = {
      id: 'user-wide',
      name: 'Wide',
      pages: 2,
      slots: [wide, wide],
    }
    const next = applyBookOp(book, {
      type: 'fillBook',
      assetIds: ids12,
      templates: [saved],
      maxPages: 120,
    })
    expect(next).toEqual(fillBook(book, ids12, [saved], 120))
    expect(next.spreads[2]?.templateId).toBe('user-wide')
    expect(photos(next)[2]).toEqual(['p4', 'p5'])
  })
})
