import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants, MIN_TEXT_FRAME_MM } from '../index'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const RECT = { x: 20, y: 30, width: 60, height: 14 }

function textFrame(overrides: Partial<Frame> = {}): Frame {
  return makeFrame({
    id: 't1',
    rect: RECT,
    z: 2,
    kind: 'text',
    content: { type: 'static', text: 'Hi' },
    ...overrides,
  })
}

function book(frames: Frame[] = [makeFrame({ id: 'p1', z: 1 })]): Book {
  return makeBook({
    assets: { a: {} },
    gallery: ['a'],
    spreads: [makeSpread({ templateId: 'one-per-page', frames })],
  })
}

function frameOf(next: Book, id: string): Frame | undefined {
  return next.spreads[0]?.frames.find((frame) => frame.id === id)
}

describe('addTextFrame', () => {
  it('appends an empty caption text frame on top and keeps the layout', () => {
    const next = applyBookOp(book(), {
      type: 'addTextFrame',
      spreadId: 'spread-1',
      rect: RECT,
    })
    expect(next.spreads[0]?.templateId).toBe('one-per-page')
    expect(frameOf(next, 'frame-2')).toEqual({
      id: 'frame-2',
      rect: RECT,
      z: 2,
      kind: 'text',
      styleId: 'caption',
      align: 'left',
      content: { type: 'static', text: '' },
    })
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('takes a given id and refuses one already on the spread', () => {
    const add = (b: Book, id: string) =>
      applyBookOp(b, {
        type: 'addTextFrame',
        spreadId: 'spread-1',
        rect: RECT,
        id,
      })
    const once = add(book(), 'note')
    expect(frameOf(once, 'note')?.kind).toBe('text')
    expect(add(once, 'note')).toBe(once)
  })

  it('accepts the minimum box and rejects anything smaller', () => {
    const add = (width: number, height: number) =>
      applyBookOp(book(), {
        type: 'addTextFrame',
        spreadId: 'spread-1',
        rect: { x: 0, y: 0, width, height },
      })
    const { width, height } = MIN_TEXT_FRAME_MM
    expect(add(width, height).spreads[0]?.frames).toHaveLength(2)
    const base = book()
    expect(
      applyBookOp(base, {
        type: 'addTextFrame',
        spreadId: 'spread-1',
        rect: { x: 0, y: 0, width: width - 0.1, height },
      }),
    ).toBe(base)
    expect(
      applyBookOp(base, {
        type: 'addTextFrame',
        spreadId: 'spread-1',
        rect: { x: 0, y: 0, width, height: height - 0.1 },
      }),
    ).toBe(base)
  })
})

describe('editText', () => {
  const edit = (b: Book, text: string, fitHeightMm?: number) =>
    applyBookOp(b, {
      type: 'editText',
      spreadId: 'spread-1',
      frameId: 't1',
      text,
      ...(fitHeightMm === undefined ? {} : { fitHeightMm }),
    })

  it('sets static text and keeps the box without a fit height', () => {
    const next = edit(book([textFrame()]), 'Morning on the lake')
    expect(frameOf(next, 't1')?.content).toEqual({
      type: 'static',
      text: 'Morning on the lake',
    })
    expect(frameOf(next, 't1')?.rect).toBe(RECT)
    // A fit height inside the box keeps the same rect object.
    expect(frameOf(edit(book([textFrame()]), 'Yo', 5), 't1')?.rect).toBe(RECT)
  })

  it('edits a template as a template', () => {
    const b = book([
      textFrame({ content: { type: 'template', template: '{title}' } }),
    ])
    expect(edit(b, '{title}')).toBe(b)
    expect(frameOf(edit(b, '{date}'), 't1')?.content).toEqual({
      type: 'template',
      template: '{date}',
    })
  })

  it('grows the box down to the fit height', () => {
    const next = edit(book([textFrame()]), 'Hi', 21.7)
    expect(frameOf(next, 't1')?.rect).toEqual({ ...RECT, height: 21.7 })
  })

  it('caps the growth at the paper bottom', () => {
    const b = book([
      textFrame({ rect: { x: 0, y: 280, width: 60, height: 14 } }),
    ])
    expect(frameOf(edit(b, 'Hi', 40), 't1')?.rect.height).toBe(20)
  })

  it('never shrinks the box', () => {
    const b = book([textFrame()])
    expect(edit(b, 'Hi', 5)).toBe(b)
    const low = book([
      textFrame({ rect: { x: 0, y: 295, width: 60, height: 14 } }),
    ])
    expect(edit(low, 'Hi', 30)).toBe(low)
  })

  it('is a no-op on unchanged text and on an image frame', () => {
    const b = book([textFrame(), makeFrame({ id: 'p1' })])
    expect(edit(b, 'Hi')).toBe(b)
    expect(
      applyBookOp(b, {
        type: 'editText',
        spreadId: 'spread-1',
        frameId: 'p1',
        text: 'x',
      }),
    ).toBe(b)
  })

  it('edits a frame with no content yet', () => {
    const b = book([textFrame({ content: undefined })])
    expect(frameOf(edit(b, ''), 't1')?.content).toEqual({
      type: 'static',
      text: '',
    })
  })
})

describe('setTextStyle / setTextAlign', () => {
  it('restyle and re-align without moving the box', () => {
    const b = book([textFrame({ styleId: 'caption' })])
    const styled = applyBookOp(b, {
      type: 'setTextStyle',
      spreadId: 'spread-1',
      frameId: 't1',
      styleId: 'title',
    })
    const aligned = applyBookOp(styled, {
      type: 'setTextAlign',
      spreadId: 'spread-1',
      frameId: 't1',
      align: 'center',
    })
    expect(frameOf(aligned, 't1')).toMatchObject({
      styleId: 'title',
      align: 'center',
      rect: RECT,
    })
  })

  it('treat the defaults (caption / left) as current values', () => {
    const b = book([textFrame()])
    expect(
      applyBookOp(b, {
        type: 'setTextStyle',
        spreadId: 'spread-1',
        frameId: 't1',
        styleId: 'caption',
      }),
    ).toBe(b)
    expect(
      applyBookOp(b, {
        type: 'setTextAlign',
        spreadId: 'spread-1',
        frameId: 't1',
        align: 'left',
      }),
    ).toBe(b)
  })

  it('leave image frames alone', () => {
    const b = book()
    expect(
      applyBookOp(b, {
        type: 'setTextStyle',
        spreadId: 'spread-1',
        frameId: 'p1',
        styleId: 'body',
      }),
    ).toBe(b)
    expect(
      applyBookOp(b, {
        type: 'setTextAlign',
        spreadId: 'spread-1',
        frameId: 'p1',
        align: 'right',
      }),
    ).toBe(b)
  })
})

describe('photo ops skip text frames', () => {
  const withText = () =>
    book([makeFrame({ id: 'p1', assetId: 'a' }), textFrame()])

  it('place and replace leave a text frame unchanged', () => {
    const b = withText()
    for (const type of ['place', 'replace'] as const) {
      expect(
        applyBookOp(b, {
          type,
          spreadId: 'spread-1',
          frameId: 't1',
          assetId: 'a',
        }),
      ).toBe(b)
    }
  })

  it('swap with a text frame returns the same book', () => {
    const b = withText()
    expect(
      applyBookOp(b, {
        type: 'swap',
        spreadIdA: 'spread-1',
        frameIdA: 'p1',
        spreadIdB: 'spread-1',
        frameIdB: 't1',
      }),
    ).toBe(b)
  })

  it('fill never targets nor fills a text frame', () => {
    const b = book([textFrame(), makeFrame({ id: 'p1' })])
    const fill = (frameId: string) =>
      applyBookOp(b, {
        type: 'fillSpread',
        spreadId: 'spread-1',
        frameId,
        assetIds: ['a'],
      })
    expect(fill('t1')).toBe(b)
    const next = fill('p1')
    expect(frameOf(next, 'p1')?.assetId).toBe('a')
    expect(frameOf(next, 't1')).toBe(b.spreads[0]?.frames[0])
    expect(checkBookInvariants(next).ok).toBe(true)
  })
})
