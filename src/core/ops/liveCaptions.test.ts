import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants } from '../index'
import type { Book, Frame, Spread } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { defaultAnchorFrame } from './frames'

const TEXT_RECT = { x: 20, y: 130, width: 60, height: 6 }

function textFrame(overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: 't1',
    rect: TEXT_RECT,
    z: 9,
    kind: 'text',
    content: { type: 'static', text: '{title} · {date}' },
    ...overrides,
  })
}

const liveText = (overrides: Partial<Frame> = {}): Frame =>
  textFrame({
    content: { type: 'template', template: '{title} · {date}' },
    anchorFrameId: 'p1',
    ...overrides,
  })

/** Photo `p1` right above the text, empty `p2` beside it. */
function book(frames?: Frame[], extra: Spread[] = []): Book {
  return makeBook({
    assets: {
      a: { capturedAt: '2025:07:12 08:35:00', meta: { title: 'Lake' } },
      b: { meta: { title: 'Hill' } },
    },
    gallery: ['a', 'b'],
    spreads: [
      makeSpread({
        templateId: 'one-per-page',
        frames: frames ?? [
          makeFrame({
            id: 'p1',
            assetId: 'a',
            rect: { x: 20, y: 20, width: 100, height: 100 },
          }),
          makeFrame({
            id: 'p2',
            z: 1,
            rect: { x: 160, y: 20, width: 100, height: 100 },
          }),
          textFrame(),
        ],
      }),
      ...extra,
    ],
  })
}

function frameOf(next: Book, id: string): Frame | undefined {
  return next.spreads[0]?.frames.find((frame) => frame.id === id)
}

const at = { spreadId: 'spread-1', frameId: 't1' }

describe('setTextLive', () => {
  it('on: the text becomes the template, anchored to the nearest photo', () => {
    const next = applyBookOp(book(), { type: 'setTextLive', ...at, live: true })
    expect(frameOf(next, 't1')).toMatchObject({
      content: { type: 'template', template: '{title} · {date}' },
      anchorFrameId: 'p1',
    })
    expect(next.spreads[0]?.templateId).toBe('one-per-page')
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('off (Make static): stores the painted text and drops the anchor', () => {
    const live = book([makeFrame({ id: 'p1', assetId: 'a' }), liveText()])
    const next = applyBookOp(live, { type: 'setTextLive', ...at, live: false })
    const frame = frameOf(next, 't1')
    expect(frame?.content).toEqual({
      type: 'static',
      text: 'Lake · 12 Jul 2025',
    })
    expect(frame).not.toHaveProperty('anchorFrameId')
  })

  it('no-ops when already in the asked state, off a text frame or a book spread', () => {
    const b = book()
    expect(applyBookOp(b, { type: 'setTextLive', ...at, live: false })).toBe(b)
    const live = book([makeFrame({ id: 'p1' }), liveText()])
    expect(applyBookOp(live, { type: 'setTextLive', ...at, live: true })).toBe(
      live,
    )
    for (const target of [
      { spreadId: 'spread-1', frameId: 'p1' },
      { spreadId: 'spread-1', frameId: 'nope' },
      { spreadId: 'nope', frameId: 't1' },
    ]) {
      expect(
        applyBookOp(b, { type: 'setTextLive', ...target, live: true }),
      ).toBe(b)
    }
    const parented: Book = {
      ...b,
      parents: [
        {
          id: 'parent-1',
          name: 'Master A',
          frames: [makeFrame({ id: 'p1' }), textFrame()],
          guides: [],
        },
      ],
    }
    expect(
      applyBookOp(parented, {
        type: 'setTextLive',
        spreadId: 'parent-1',
        frameId: 't1',
        live: true,
      }),
    ).toBe(parented)
  })

  it('finds the text frame on the spread it names', () => {
    const second = makeSpread({
      id: 'spread-2',
      frames: [makeFrame({ id: 'q1', assetId: 'b' }), textFrame({ id: 't9' })],
    })
    const b = book(undefined, [second])
    const next = applyBookOp(b, {
      type: 'setTextLive',
      spreadId: 'spread-2',
      frameId: 't9',
      live: true,
    })
    expect(
      next.spreads[1]?.frames.find((frame) => frame.id === 't9')?.anchorFrameId,
    ).toBe('q1')
    expect(next.spreads[0]).toBe(b.spreads[0])
  })

  it('no-ops on a spread without image frames', () => {
    const b = book([textFrame()])
    expect(applyBookOp(b, { type: 'setTextLive', ...at, live: true })).toBe(b)
  })

  it('an empty text goes live with an empty template', () => {
    const b = book([makeFrame({ id: 'p1' }), textFrame({ content: undefined })])
    const next = applyBookOp(b, { type: 'setTextLive', ...at, live: true })
    expect(frameOf(next, 't1')?.content).toEqual({
      type: 'template',
      template: '',
    })
  })
})

describe('defaultAnchorFrame', () => {
  const text = textFrame({ rect: { x: 50, y: 50, width: 10, height: 10 } })
  const at = (id: string, x: number, y: number, assetId?: string): Frame =>
    makeFrame({
      id,
      rect: { x, y, width: 10, height: 10 },
      ...(assetId === undefined ? {} : { assetId }),
    })
  const pick = (frames: Frame[]) =>
    defaultAnchorFrame(makeSpread({ frames: [...frames, text] }), text)?.id

  it('prefers a photo, however far, over a nearer empty frame', () => {
    expect(pick([at('empty', 60, 50), at('far', 200, 200, 'a')])).toBe('far')
  })

  it('measures rect to rect: overlap is 0, a diagonal gap is its hypotenuse', () => {
    expect(pick([at('side', 63, 50, 'a'), at('over', 55, 55, 'a')])).toBe(
      'over',
    )
    // Diagonal gap 3/4 → 5 mm beats a straight 6 mm gap.
    expect(pick([at('right', 66, 50, 'a'), at('diag', 63, 64, 'a')])).toBe(
      'diag',
    )
    expect(pick([at('above', 50, 34, 'a'), at('left', 37, 50, 'a')])).toBe(
      'left',
    )
  })

  it('measures the gap on each side of the text box', () => {
    // Left gap 3 vs right gap 2; above gap 2 vs below gap 3.
    expect(pick([at('left', 37, 50, 'a'), at('right', 62, 50, 'a')])).toBe(
      'right',
    )
    expect(pick([at('below', 50, 63, 'a'), at('above', 50, 38, 'a')])).toBe(
      'above',
    )
  })

  it('breaks ties by lower index and falls back to the nearest empty frame', () => {
    expect(pick([at('first', 30, 50, 'a'), at('second', 70, 50, 'a')])).toBe(
      'first',
    )
    expect(pick([at('far', 200, 50), at('near', 70, 50)])).toBe('near')
    expect(pick([])).toBeUndefined()
  })
})

describe('setTextAnchor', () => {
  const live = () =>
    book([
      makeFrame({ id: 'p1', assetId: 'a' }),
      makeFrame({ id: 'p2', assetId: 'b' }),
      textFrame({ id: 't2' }),
      liveText(),
    ])

  it('re-anchors a live caption to another image frame', () => {
    const next = applyBookOp(live(), {
      type: 'setTextAnchor',
      ...at,
      anchorFrameId: 'p2',
    })
    expect(frameOf(next, 't1')?.anchorFrameId).toBe('p2')
  })

  it('ignores the same anchor, text or unknown frames and static text', () => {
    const b = live()
    for (const anchorFrameId of ['p1', 't2', 'nope']) {
      expect(
        applyBookOp(b, { type: 'setTextAnchor', ...at, anchorFrameId }),
      ).toBe(b)
    }
    expect(
      applyBookOp(b, {
        type: 'setTextAnchor',
        spreadId: 'spread-1',
        frameId: 't2',
        anchorFrameId: 'p2',
      }),
    ).toBe(b)
    const empty = book([
      makeFrame({ id: 'p2' }),
      textFrame({ content: undefined }),
    ])
    expect(
      applyBookOp(empty, { type: 'setTextAnchor', ...at, anchorFrameId: 'p2' }),
    ).toBe(empty)
  })
})

describe('editText on a live caption', () => {
  it('edits the template and keeps the anchor; the same template is a no-op', () => {
    const b = book([makeFrame({ id: 'p1', assetId: 'a' }), liveText()])
    const next = applyBookOp(b, { type: 'editText', ...at, text: '{date}' })
    expect(frameOf(next, 't1')).toMatchObject({
      content: { type: 'template', template: '{date}' },
      anchorFrameId: 'p1',
    })
    expect(
      applyBookOp(b, { type: 'editText', ...at, text: '{title} · {date}' }),
    ).toBe(b)
  })
})

describe('anchor normalisation', () => {
  const live = () =>
    book(
      [
        makeFrame({ id: 'p1', assetId: 'a' }),
        makeFrame({ id: 'p2' }),
        liveText(),
      ],
      [makeSpread({ id: 'spread-2', frames: [] })],
    )

  it('deleting the anchor freezes the caption to the text painted before', () => {
    const next = applyBookOp(live(), {
      type: 'removeFrames',
      spreadId: 'spread-1',
      frameIds: ['p1'],
    })
    const frame = frameOf(next, 't1')
    expect(frame?.content).toEqual({
      type: 'static',
      text: 'Lake · 12 Jul 2025',
    })
    expect(frame).not.toHaveProperty('anchorFrameId')
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('keeps live captions whose anchor survives, and untouched spreads', () => {
    const b = live()
    const next = applyBookOp(b, {
      type: 'removeFrames',
      spreadId: 'spread-1',
      frameIds: ['p2'],
    })
    expect(frameOf(next, 't1')?.anchorFrameId).toBe('p1')
    expect(next.spreads[1]).toBe(b.spreads[1])
  })

  it('drops a stale anchor from static text and keeps its text', () => {
    const b = book([
      makeFrame({ id: 'p1' }),
      textFrame({
        anchorFrameId: 'p1',
        content: { type: 'static', text: 'x' },
      }),
    ])
    const next = applyBookOp(b, {
      type: 'removeFrames',
      spreadId: 'spread-1',
      frameIds: ['p1'],
    })
    expect(frameOf(next, 't1')).toEqual(
      textFrame({ content: { type: 'static', text: 'x' } }),
    )
  })

  it('freezes against its own spread before the op', () => {
    const second = makeSpread({
      id: 'spread-2',
      frames: [
        makeFrame({ id: 'q1', assetId: 'b' }),
        liveText({
          anchorFrameId: 'q1',
          content: { type: 'template', template: '{title} · {spread}' },
        }),
      ],
    })
    const next = applyBookOp(book(undefined, [second]), {
      type: 'removeFrames',
      spreadId: 'spread-2',
      frameIds: ['q1'],
    })
    expect(next.spreads[1]?.frames).toEqual([
      textFrame({ content: { type: 'static', text: 'Hill · 2' } }),
    ])
  })

  it('also freezes a caption anchored to a text frame once its spread changes', () => {
    const b = book([
      makeFrame({ id: 'p1', assetId: 'a' }),
      textFrame({ id: 't2' }),
      liveText({ anchorFrameId: 't2' }),
    ])
    const next = applyBookOp(b, {
      type: 'moveFrame',
      spreadId: 'spread-1',
      frameId: 'p1',
      dx: 1,
      dy: 0,
    })
    expect(frameOf(next, 't1')).toEqual(
      textFrame({ content: { type: 'static', text: '— · —' } }),
    )
  })

  it('a layout that re-mints image frames leaves a valid book', () => {
    const next = applyBookOp(live(), {
      type: 'applyTemplate',
      spreadId: 'spread-1',
      templateId: '4-grid',
    })
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('duplicateSpread keeps the copy anchored to its own frame', () => {
    const next = applyBookOp(live(), {
      type: 'duplicateSpread',
      spreadId: 'spread-1',
    })
    expect(
      next.spreads[1]?.frames.find((frame) => frame.id === 't1')?.anchorFrameId,
    ).toBe('p1')
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })
})
