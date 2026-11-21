import { describe, expect, it } from 'vitest'
import {
  applyBookOp,
  framesPayload,
  nextFrameIds,
  pastedRects,
  stepRepeatOffset,
  unmatchedPhotoCount,
  type FramesPayload,
} from '../index'
import type { Book, Frame, Spread } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const HASH = 'a'.repeat(64)
const rect = (x: number, y: number, width = 100, height = 100) => ({
  x,
  y,
  width,
  height,
})
const frame = (id: string, x: number, y: number, extra: Partial<Frame> = {}) =>
  makeFrame({ id, rect: rect(x, y), z: 1, ...extra })

/** Page 1 (right single, 300 wide), a two-page spread (600), last page (left single). */
function book(
  spreads: { first?: Frame[]; middle?: Frame[]; last?: Frame[] } = {},
  extra: Partial<Spread> = {},
): Book {
  return makeBook({
    assets: { a: { contentHash: HASH }, b: { meta: { title: 'Lake' } } },
    gallery: ['a', 'b'],
    frameStyles: { thin: { strokeMm: 1 } },
    spreads: [
      makeSpread({ id: 'first', frames: spreads.first ?? [] }),
      makeSpread({
        id: 'middle',
        templateId: 'one-per-page',
        frames: spreads.middle ?? [],
        ...extra,
      }),
      makeSpread({ id: 'last', frames: spreads.last ?? [] }),
    ],
  })
}

const rects = (b: Book, spreadId: string) =>
  b.spreads
    .find((s) => s.id === spreadId)
    ?.frames.map((f) => ({ id: f.id, ...f.rect }))

function paste(
  b: Book,
  payload: FramesPayload,
  spreadId: string,
  inPlace = false,
  ids?: string[],
): Book {
  return applyBookOp(b, {
    type: 'pasteFrames',
    spreadId,
    payload,
    inPlace,
    ...(ids && { ids }),
  })
}

describe('pastedRects: D3 steps', () => {
  it('steps +5/+5 mm off a taken spot and keeps a free one', () => {
    const b = book({ middle: [frame('f1', 10, 10)] })
    const p = framesPayload(b, 'middle', ['f1'])
    expect(pastedRects(b, 'middle', p, { inPlace: false })).toEqual([
      rect(15, 15),
    ])
    const other = book({ middle: [frame('f1', 10, 10)], last: [] })
    expect(pastedRects(other, 'first', p, { inPlace: false })).toEqual([
      rect(10, 10),
    ])
  })

  it('stops after 20 steps even when the spot is still taken', () => {
    const taken = Array.from({ length: 21 }, (_, k) =>
      frame(`f${String(k)}`, 10 + 5 * k, 10 + 5 * k),
    )
    const b = book({ middle: taken })
    const p = framesPayload(b, 'middle', ['f0'])
    expect(pastedRects(b, 'middle', p, { inPlace: false })).toEqual([
      rect(110, 110),
    ])
    const free = book({ middle: taken.slice(0, 20) })
    expect(pastedRects(free, 'middle', p, { inPlace: false })).toEqual([
      rect(110, 110),
    ])
    const early = book({ middle: taken.slice(0, 3) })
    expect(pastedRects(early, 'middle', p, { inPlace: false })).toEqual([
      rect(25, 25),
    ])
  })

  it('never steps in place and ignores the offset there', () => {
    const b = book({ middle: [frame('f1', 10, 10)] })
    const p = framesPayload(b, 'middle', ['f1'])
    expect(
      pastedRects(b, 'middle', p, { inPlace: true, offset: { x: 40, y: 40 } }),
    ).toEqual([rect(10, 10)])
    expect(rects(paste(b, p, 'middle', true, ['n1']), 'middle')?.[1]).toEqual({
      id: 'n1',
      ...rect(10, 10),
    })
  })

  it('treats a gap of exactly 0.01 mm as taken', () => {
    const source = makeFrame({
      id: 'f1',
      rect: { x: 10, y: 0.02, width: 0.02, height: 10 },
    })
    const b = book({
      middle: [source],
      last: [makeFrame({ rect: { x: 10, y: 0.01, width: 0.01, height: 10 } })],
    })
    const p = framesPayload(b, 'middle', ['f1'])
    expect(pastedRects(b, 'last', p, { inPlace: false })).toEqual([
      { x: 15, y: 5.02, width: 0.02, height: 10 },
    ])
  })

  it('steps when any one rect of the group is taken', () => {
    const b = book({
      middle: [frame('f1', 10, 10), frame('f2', 150, 10)],
      last: [frame('x', 150, 10)],
    })
    const p = framesPayload(b, 'middle', ['f1', 'f2'])
    expect(pastedRects(b, 'last', p, { inPlace: false })).toEqual([
      rect(15, 15),
      rect(155, 15),
    ])
  })

  it('takes a spot within 0.01 mm on every edge', () => {
    const p = framesPayload(book({ middle: [frame('f1', 10, 10)] }), 'middle', [
      'f1',
    ])
    const near = (r: Frame['rect']) =>
      pastedRects(book({ first: [makeFrame({ rect: r })] }), 'first', p, {
        inPlace: false,
      })
    expect(near(rect(10.005, 10))).toEqual([rect(15, 15)])
    expect(near({ ...rect(10, 10), height: 100.005 })).toEqual([rect(15, 15)])
    expect(near({ ...rect(10, 10), width: 99.995 })).toEqual([rect(15, 15)])
    expect(near(rect(10, 9.995))).toEqual([rect(15, 15)])
    expect(near(rect(10.02, 10))).toEqual([rect(10, 10)])
    expect(near(rect(10, 10.02))).toEqual([rect(10, 10)])
    expect(near({ ...rect(10, 10), width: 100.02 })).toEqual([rect(10, 10)])
    expect(near({ ...rect(10, 10), height: 99.98 })).toEqual([rect(10, 10)])
  })

  it('returns no rects for an unknown spread or an empty payload', () => {
    const b = book({ middle: [frame('f1', 10, 10)] })
    const p = framesPayload(b, 'middle', ['f1'])
    expect(pastedRects(b, 'nope', p, { inPlace: false })).toEqual([])
    expect(
      pastedRects(b, 'middle', framesPayload(b, 'middle', []), {
        inPlace: false,
      }),
    ).toEqual([])
  })
})

describe('pastedRects: D4 single pages', () => {
  const at = (from: string, x: number, to: string, width = 100) => {
    const source = frame('f1', x, 10, { rect: rect(x, 10, width) })
    const b = book({
      first: from === 'first' ? [source] : [],
      middle: from === 'middle' ? [source] : [],
      last: from === 'last' ? [source] : [],
    })
    const p = framesPayload(b, from, ['f1'])
    return pastedRects(b, to, p, { inPlace: true })[0]?.x
  }

  it('maps page 1 (right single) through the spread slot', () => {
    expect(at('middle', 350, 'first')).toBe(50)
    expect(at('middle', 50, 'first')).toBe(50)
    expect(at('first', 50, 'middle')).toBe(350)
    expect(at('last', 50, 'first')).toBe(50)
  })

  it('maps the last page (left single) through the spread slot', () => {
    expect(at('middle', 350, 'last')).toBe(50)
    expect(at('middle', 50, 'last')).toBe(50)
    expect(at('first', 50, 'last')).toBe(50)
    expect(at('last', 50, 'middle')).toBe(50)
  })

  it('clamps into the page + bleed and centres a group bigger than it', () => {
    expect(at('middle', 250, 'first')).toBe(-3)
    expect(at('middle', 0, 'first', 303)).toBe(0)
    const tall = book({
      middle: [frame('f1', 10, 10), frame('f2', 10, 150, { z: 2 })],
    })
    expect(
      pastedRects(tall, 'middle', framesPayload(tall, 'middle', ['f1', 'f2']), {
        inPlace: false,
        offset: { x: 0, y: -20 },
      }).map((r) => r.y),
    ).toEqual([-3, 137])
    expect(at('middle', 250, 'last')).toBe(203)
    expect(at('middle', 100, 'first', 400)).toBe(-50)
    expect(at('middle', 100, 'last', 400)).toBe(-50)
    const low = book({ middle: [frame('f1', 10, 250)] })
    expect(
      pastedRects(low, 'middle', framesPayload(low, 'middle', ['f1']), {
        inPlace: false,
        offset: { x: 0, y: 100 },
      }),
    ).toEqual([rect(10, 203)])
    const high = book({ middle: [frame('f1', 10, -50)] })
    expect(
      pastedRects(high, 'middle', framesPayload(high, 'middle', ['f1']), {
        inPlace: true,
      }),
    ).toEqual([rect(10, -3)])
  })

  it('moves a group as one', () => {
    const b = book({
      middle: [frame('f1', 250, 10), frame('f2', 400, 150, { z: 2 })],
    })
    const p = framesPayload(b, 'middle', ['f1', 'f2'])
    // bbox 250..500, centre 375 (right half) → page 1 at −50..200 → +47.
    expect(pastedRects(b, 'first', p, { inPlace: true })).toEqual([
      rect(-3, 10),
      rect(147, 150),
    ])
  })
})

describe('pasteFrames: D5 copies', () => {
  it('adds unlocked own copies on top in z order with nextFrameId ids', () => {
    const b = book(
      {
        middle: [
          frame('frame-1', 10, 10, { z: 3, locked: true }),
          frame('frame-2', 200, 10, { z: 1 }),
        ],
      },
      {
        parentOverrides: {
          frames: [{ ...frame('c1', 400, 10, { z: 7 }), overridesId: 'pf' }],
        },
      },
    )
    const p = framesPayload(b, 'middle', ['frame-1', 'c1', 'frame-2'])
    expect(p.frames.map((f) => f.id)).toEqual(['frame-2', 'frame-1', 'c1'])
    expect(nextFrameIds(b, 'middle', 3)).toEqual([
      'frame-4',
      'frame-5',
      'frame-6',
    ])
    const next = paste(b, p, 'middle')
    const spread = next.spreads[1]
    expect(spread?.templateId).toBeUndefined()
    const copies = spread?.frames.slice(2) ?? []
    expect(copies.map((f) => [f.id, f.z, f.rect.x])).toEqual([
      ['frame-4', 8, 205],
      ['frame-5', 9, 15],
      ['frame-6', 10, 405],
    ])
    for (const copy of copies) {
      expect(copy.locked).toBeUndefined()
      expect('overridesId' in copy).toBe(false)
      expect(copy.content).toBeUndefined()
    }
    expect(spread?.frames.slice(0, 2)).toEqual(b.spreads[1]?.frames)
  })

  it('uses given ids and refuses bad ones', () => {
    const b = book({ middle: [frame('f1', 10, 10)] })
    const p = framesPayload(b, 'middle', ['f1'])
    expect(rects(paste(b, p, 'last', false, ['n1']), 'last')).toEqual([
      { id: 'n1', ...rect(10, 10) },
    ])
    expect(paste(b, p, 'middle', false, ['f1'])).toBe(b)
    expect(paste(b, p, 'middle', false, ['n1', 'n2'])).toBe(b)
    expect(paste(b, p, 'nope')).toBe(b)
    expect(paste(b, framesPayload(b, 'nope', ['f1']), 'middle')).toBe(b)
    expect(nextFrameIds(b, 'nope', 2)).toEqual([])
    const gap = book({
      middle: [frame('frame-1', 0, 0), frame('frame-3', 0, 0)],
    })
    expect(nextFrameIds(gap, 'middle', 2)).toEqual(['frame-4', 'frame-5'])
    expect(framesPayload(b, 'nope', ['f1'])).toStrictEqual({
      v: 1,
      bookId: 'book-1',
      spreadId: 'nope',
      side: null,
      trim: { widthMm: 300, heightMm: 300 },
      frames: [],
      texts: {},
      assets: {},
    })
    const two = framesPayload(
      book({ middle: [frame('f1', 10, 10), frame('f2', 200, 10)] }),
      'middle',
      ['f1', 'f2'],
    )
    expect(paste(b, two, 'last', false, ['n1', 'n1'])).toBe(b)
  })

  it('cut is only a label on removeFrames', () => {
    const b = book({ middle: [frame('f1', 10, 10), frame('f2', 200, 10)] })
    expect(
      applyBookOp(b, {
        type: 'removeFrames',
        spreadId: 'middle',
        frameIds: ['f1'],
        cut: true,
      }),
    ).toEqual(
      applyBookOp(b, {
        type: 'removeFrames',
        spreadId: 'middle',
        frameIds: ['f1'],
      }),
    )
  })
})

describe('pasteFrames: D6 live captions', () => {
  const photo = frame('p1', 10, 10, { assetId: 'b' })
  const caption = makeFrame({
    id: 't1',
    rect: rect(10, 120, 100, 6),
    z: 2,
    kind: 'text',
    content: { type: 'template', template: '{title}' },
    anchorFrameId: 'p1',
  })
  const b = book({ middle: [photo, caption] })

  it('remaps an anchor copied with it', () => {
    const p = framesPayload(b, 'middle', ['p1', 't1'])
    expect(p.texts).toStrictEqual({ t1: 'Lake' })
    const out = paste(b, p, 'last', false, ['n1', 'n2'])
    expect(out.spreads[2]?.frames[1]).toMatchObject({
      id: 'n2',
      anchorFrameId: 'n1',
      content: { type: 'template', template: '{title}' },
    })
  })

  it('keeps an anchor still on its source spread', () => {
    const p = framesPayload(b, 'middle', ['t1'])
    expect(p.texts).toEqual({ t1: 'Lake' })
    const out = paste(b, p, 'middle', false, ['n1'])
    expect(out.spreads[1]?.frames[2]).toMatchObject({
      id: 'n1',
      anchorFrameId: 'p1',
      content: { type: 'template', template: '{title}' },
    })
  })

  it('turns static with the copied text elsewhere', () => {
    const p = framesPayload(b, 'middle', ['t1'])
    const out = paste(b, p, 'last', false, ['n1'])
    const copy = out.spreads[2]?.frames[0]
    expect(copy?.content).toEqual({ type: 'static', text: 'Lake' })
    expect(copy?.anchorFrameId).toBeUndefined()
    const gone = applyBookOp(
      book({ middle: [photo, frame('p2', 200, 10), caption] }),
      { type: 'removeFrames', spreadId: 'middle', frameIds: ['p1'] },
    )
    expect(
      paste(gone, p, 'middle', false, ['n1']).spreads[1]?.frames[2],
    ).toMatchObject({ content: { type: 'static', text: 'Lake' } })
    const textNow = applyBookOp(gone, {
      type: 'addTextFrame',
      spreadId: 'middle',
      rect: rect(10, 200, 50, 10),
      id: 'p1',
    })
    const onText = paste(textNow, p, 'middle', false, ['n1']).spreads[1]
    expect(onText?.frames[3]).toMatchObject({
      id: 'n1',
      content: { type: 'static', text: 'Lake' },
    })
    expect(onText?.frames[3]?.anchorFrameId).toBeUndefined()
    const otherBook = paste({ ...b, id: 'book-2' }, p, 'middle', false, ['n1'])
    expect(otherBook.spreads[1]?.frames[2]?.anchorFrameId).toBeUndefined()
    expect(
      paste(b, { ...p, texts: {} }, 'last').spreads[2]?.frames[0]?.content,
    ).toEqual({ type: 'static', text: '' })
  })
})

describe('pasteFrames: D7 other book', () => {
  const crop = { zoom: 1, center: { x: 0.5, y: 0.5 } }
  const source = makeBook({
    id: 'book-1',
    assets: {
      h: { contentHash: HASH, sourceRootId: 'r', relativePath: 'x.jpg' },
      p: { sourceRootId: 'r', relativePath: 'y.jpg' },
      m: { sourceRootId: 'r', relativePath: 'z.jpg' },
    },
    gallery: ['h', 'p', 'm'],
    frameStyles: { thin: { strokeMm: 1 }, gone: { strokeMm: 2 } },
    spreads: [
      makeSpread({
        id: 's',
        frames: [
          frame('f1', 10, 10, { assetId: 'h', crop, frameStyleId: 'thin' }),
          frame('f2', 120, 10, { assetId: 'p', crop, frameStyleId: 'gone' }),
          frame('f3', 230, 10, { assetId: 'm', crop }),
          frame('f4', 10, 150),
        ],
      }),
    ],
  })
  const target = makeBook({
    id: 'book-2',
    assets: {
      x: { sourceRootId: 'r', relativePath: 'y.jpg' },
      y: { contentHash: HASH, sourceRootId: 'q', relativePath: 'other.jpg' },
      z: { sourceRootId: 'q', relativePath: 'z.jpg' },
      // Same id as the source's `m`, another photo: ids never match across books.
      m: { relativePath: 'z.jpg' },
    },
    gallery: ['x', 'y', 'z', 'm'],
    frameStyles: { thin: { strokeMm: 1 } },
    spreads: [makeSpread({ id: 't', frames: [] })],
  })
  const copyAll = () => framesPayload(source, 's', ['f1', 'f2', 'f3', 'f4'])

  it('records the asset identities', () => {
    expect(copyAll().assets).toStrictEqual({
      h: { contentHash: HASH, sourceRootId: 'r', relativePath: 'x.jpg' },
      p: { sourceRootId: 'r', relativePath: 'y.jpg' },
      m: { sourceRootId: 'r', relativePath: 'z.jpg' },
    })
    const bare = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [makeSpread({ frames: [frame('f1', 0, 0, { assetId: 'a' })] })],
    })
    expect(framesPayload(bare, 'spread-1', ['f1']).assets).toStrictEqual({
      a: {},
    })
  })

  it('needs both root and path, and a hash only matches a hash', () => {
    const half = (wanted: object, have: object) =>
      paste(
        makeBook({
          id: 'book-2',
          assets: { q: have },
          gallery: ['q'],
          spreads: [makeSpread({ id: 't', frames: [] })],
        }),
        { ...copyAll(), assets: { h: wanted } },
        't',
      ).spreads[0]?.frames[0]?.assetId
    expect(half({ relativePath: 'x.jpg' }, { relativePath: 'x.jpg' })).toBe(
      undefined,
    )
    expect(half({ sourceRootId: 'r' }, { sourceRootId: 'r' })).toBe(undefined)
    expect(half({ contentHash: HASH }, {})).toBe(undefined)
    expect(half({ sourceRootId: 'r', relativePath: 'x.jpg' }, {})).toBe(
      undefined,
    )
    expect(
      half(
        { sourceRootId: 'r', relativePath: 'x.jpg' },
        { sourceRootId: 'r', relativePath: 'x.jpg' },
      ),
    ).toBe('q')
  })

  it('remaps by hash, then by path, else pastes empty', () => {
    const p = copyAll()
    const frames = paste(target, p, 't').spreads[0]?.frames ?? []
    expect(frames.map((f) => [f.assetId, f.crop !== undefined])).toEqual([
      ['y', true],
      ['x', true],
      [undefined, false],
      [undefined, false],
    ])
    expect(frames.map((f) => f.frameStyleId)).toEqual([
      'thin',
      undefined,
      undefined,
      undefined,
    ])
    expect(unmatchedPhotoCount(target, p)).toBe(1)
    expect(unmatchedPhotoCount(source, p)).toBe(0)
    expect(unmatchedPhotoCount(target, { ...p, assets: {} })).toBe(3)
  })

  it('keeps the same asset id in the same book', () => {
    const p = copyAll()
    const frames = paste(source, p, 's').spreads[0]?.frames.slice(4) ?? []
    expect(frames.map((f) => f.assetId)).toEqual(['h', 'p', 'm', undefined])
    const half = { ...p, assets: { h: { contentHash: HASH } } }
    const removed = { ...source, assets: { p: source.assets.p ?? {} } }
    expect(
      paste(removed, half, 's')
        .spreads[0]?.frames.slice(4)
        .map((f) => f.assetId),
    ).toEqual([undefined, 'p', undefined, undefined])
  })
})

describe('D8 duplicate offset', () => {
  const b = book({ middle: [frame('f1', 10, 10)] })

  it('duplicates at +dx/+dy and steps off a taken spot', () => {
    const dup = (dx: number, dy: number) =>
      applyBookOp(b, {
        type: 'duplicateFrames',
        spreadId: 'middle',
        frameIds: ['f1'],
        dx,
        dy,
        ids: ['d1'],
      })
    expect(rects(dup(0, 0), 'middle')?.[1]).toEqual({
      id: 'd1',
      ...rect(15, 15),
    })
    expect(rects(dup(20, 0), 'middle')?.[1]).toEqual({
      id: 'd1',
      ...rect(30, 10),
    })
  })

  it('repeats the move of the last duplicate, else +5/+5', () => {
    const once = applyBookOp(b, {
      type: 'duplicateFrames',
      spreadId: 'middle',
      frameIds: ['f1'],
      dx: 5,
      dy: 5,
      ids: ['d1'],
    })
    const moved = applyBookOp(once, {
      type: 'moveFrame',
      spreadId: 'middle',
      frameId: 'd1',
      dx: 25,
      dy: -5,
    })
    const last = {
      spreadId: 'middle',
      sourceRects: [rect(10, 10)],
      newIds: ['d1'],
    }
    expect(stepRepeatOffset(moved, 'middle', ['d1'], last)).toEqual({
      x: 30,
      y: 0,
    })
    const back = { ...last, sourceRects: [rect(15, 15)] }
    expect(stepRepeatOffset(once, 'middle', ['d1'], back)).toEqual({
      x: 5,
      y: 5,
    })
    for (const [ids, memo] of [
      [['f1'], last],
      [['d1', 'f1'], last],
      [['d1'], { ...last, spreadId: 'first' }],
      [['d1'], null],
      [['d1'], { ...last, newIds: ['gone'] }],
      [['gone'], { ...last, newIds: ['gone'] }],
      [['d1'], { ...last, sourceRects: [] }],
    ] as const) {
      expect(stepRepeatOffset(moved, 'middle', ids, memo)).toEqual({
        x: 5,
        y: 5,
      })
    }
  })
})
