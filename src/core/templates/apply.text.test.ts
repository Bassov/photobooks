import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants } from '../index'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const TEXT_RECT = { x: 20, y: 250, width: 60, height: 14 }

function text(id: string, z: number): Frame {
  return makeFrame({
    id,
    rect: TEXT_RECT,
    z,
    kind: 'text',
    styleId: 'title',
    content: { type: 'static', text: id },
  })
}

function book(frames: Frame[]): Book {
  return makeBook({
    assets: { a: {}, b: {} },
    gallery: ['a', 'b'],
    spreads: [makeSpread({ frames })],
  })
}

const LAYOUTS = [
  {
    name: 'built-in layout',
    slots: 1,
    apply: (b: Book) =>
      applyBookOp(b, {
        type: 'applyTemplate',
        spreadId: 'spread-1',
        templateId: 'full-bleed',
      }),
  },
  {
    name: 'saved layout',
    slots: 2,
    apply: (b: Book) =>
      applyBookOp(b, {
        type: 'applyCustomLayout',
        spreadId: 'spread-1',
        templateId: 'user-pair',
        slots: [
          { x: 0, y: 0, w: 50, h: 100 },
          { x: 50, y: 0, w: 50, h: 100 },
        ],
      }),
  },
]

describe.each(LAYOUTS)('$name keeps text frames', ({ apply, slots }) => {
  it('re-lays photos by image index; text keeps box and content above them', () => {
    // A text frame between the photos and below one of them.
    const b = book([
      makeFrame({ id: 'p1', assetId: 'a', z: 0 }),
      text('t1', 1),
      makeFrame({ id: 'p2', assetId: 'b', z: 5 }),
    ])
    const next = apply(b)
    const frames = next.spreads[0]?.frames ?? []
    const images = frames.filter((frame) => frame.kind !== 'text')
    const texts = frames.filter((frame) => frame.kind === 'text')
    // Slots bind image frames only; the text frame never takes a slot.
    expect(images.map((frame) => [frame.id, frame.assetId])).toEqual(
      [
        ['p1', 'a'],
        ['p2', 'b'],
      ].slice(0, slots),
    )
    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatchObject({
      id: 't1',
      rect: TEXT_RECT,
      styleId: 'title',
      content: { type: 'static', text: 't1' },
    })
    const top = Math.max(...images.map((frame) => frame.z))
    expect(texts[0]?.z).toBeGreaterThan(top)
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('re-stacks text frames above the photos in their relative order', () => {
    // Stored out of z order, and t1 is not above the laid photos.
    const next = apply(
      book([
        text('t2', 1),
        makeFrame({ id: 'p1', assetId: 'a', z: 0 }),
        makeFrame({ id: 'p2', assetId: 'b', z: 0 }),
        text('t1', 0),
      ]),
    )
    const frames = next.spreads[0]?.frames ?? []
    const top = Math.max(
      ...frames.filter((f) => f.kind !== 'text').map((f) => f.z),
    )
    const texts = frames.filter((frame) => frame.kind === 'text')
    expect(texts.map((frame) => [frame.id, frame.z])).toEqual([
      ['t1', top + 1],
      ['t2', top + 2],
    ])
  })

  it('keeps text frames already on top as the same objects', () => {
    const t1 = text('t1', 50)
    const next = apply(book([makeFrame({ id: 'p1', assetId: 'a' }), t1]))
    expect(next.spreads[0]?.frames.at(-1)).toBe(t1)
    expect(apply(next)).toBe(next)
  })
})
