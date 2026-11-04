import { describe, expect, it } from 'vitest'
import { resolveSpread, resolveTextItems } from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

describe('resolveSpread text frames', () => {
  it('resolves text, style and align on text items only', () => {
    const book = makeBook({
      title: 'Lake',
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'p1' }),
            makeFrame({
              id: 't1',
              z: 2,
              kind: 'text',
              styleId: 'title',
              align: 'center',
              content: { type: 'template', template: '{title} · {spread}' },
            }),
            makeFrame({ id: 't2', z: 3, kind: 'text' }),
          ],
        }),
      ],
    })
    const items = resolveSpread(book, 'spread-1')?.items ?? []
    expect(items.map((item) => item.text)).toEqual([
      undefined,
      { text: 'Lake · 1', styleId: 'title', align: 'center' },
      { text: '', styleId: 'caption', align: 'left' },
    ])
    expect(items[1]?.rectMm).toEqual({ x: 10, y: 10, width: 100, height: 100 })
  })

  it('resolveTextItems sets anchorFrameId only on anchored text', () => {
    const spread = makeSpread({
      frames: [
        makeFrame({ id: 'p1' }),
        makeFrame({ id: 't1', kind: 'text', anchorFrameId: 'p1' }),
        makeFrame({ id: 't2', kind: 'text' }),
      ],
    })
    const [anchored, free] = resolveTextItems(
      makeBook({ spreads: [spread] }),
      spread,
    )
    expect(anchored?.anchorFrameId).toBe('p1')
    expect(free === undefined ? [] : Object.keys(free)).not.toContain(
      'anchorFrameId',
    )
  })

  it('re-resolves template text when only the title changes', () => {
    const frames = [
      makeFrame({
        id: 't1',
        kind: 'text',
        content: { type: 'template', template: '{title}' },
      }),
    ]
    const spreads = [makeSpread({ frames })]
    const a = makeBook({ title: 'A', spreads })
    const b = { ...a, title: 'B' }
    expect(resolveSpread(a, 'spread-1')?.items[0]?.text?.text).toBe('A')
    expect(resolveSpread(b, 'spread-1')?.items[0]?.text?.text).toBe('B')
  })
})
