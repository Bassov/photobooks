import { describe, expect, it } from 'vitest'
import { applyTemplate, generateTemplateFrames, isTemplateId } from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

describe('isTemplateId', () => {
  it('accepts catalog ids and rejects others', () => {
    expect(isTemplateId('full-bleed')).toBe(true)
    expect(isTemplateId('one-per-page')).toBe(true)
    expect(isTemplateId('2-up')).toBe(true)
    expect(isTemplateId('4-grid')).toBe(true)
    expect(isTemplateId('other')).toBe(false)
    expect(isTemplateId('')).toBe(false)
  })
})

describe('template generators', () => {
  it('full-bleed covers trim plus bleed on a one-page spread', () => {
    const book = makeBook({
      settings: { bleedMm: 3, trim: { widthMm: 300, heightMm: 300 } },
    })
    const frames = generateTemplateFrames('full-bleed', book, 0)
    expect(frames).toHaveLength(1)
    expect(frames[0]?.rect).toEqual({
      x: -3,
      y: -3,
      width: 306,
      height: 306,
    })
    expect(frames[0]?.id).toBe('spread-0-f0')
    expect(frames[0]?.z).toBe(0)
  })

  it('full-bleed doubles width on an interior spread', () => {
    const book = makeBook({
      settings: { bleedMm: 2, trim: { widthMm: 200, heightMm: 250 } },
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const frames = generateTemplateFrames('full-bleed', book, 1)
    expect(frames[0]?.rect).toEqual({
      x: -2,
      y: -2,
      width: 404,
      height: 254,
    })
  })

  it('one-per-page yields one frame on a one-page spread', () => {
    const book = makeBook()
    const frames = generateTemplateFrames('one-per-page', book, 0)
    expect(frames).toHaveLength(1)
    const m = book.layoutGrid.margins
    const W = book.settings.trim.widthMm
    const H = book.settings.trim.heightMm
    expect(frames[0]?.rect).toEqual({
      x: m.left,
      y: m.top,
      width: W - m.left - m.right,
      height: H - m.top - m.bottom,
    })
  })

  it('one-per-page yields two margin-inset frames on an interior spread', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const frames = generateTemplateFrames('one-per-page', book, 1)
    expect(frames).toHaveLength(2)
    const pageW = book.settings.trim.widthMm
    const m = book.layoutGrid.margins
    expect(frames[0]?.rect.x).toBe(m.left)
    expect(frames[0]?.rect.width).toBe(pageW - m.left - m.right)
    expect(frames[1]?.rect.x).toBe(pageW + m.left)
    expect(frames[1]?.rect.width).toBe(pageW - m.left - m.right)
  })

  it('2-up uses whole-spread columns on one- and two-page spreads', () => {
    const onePage = makeBook()
    const oneFrames = generateTemplateFrames('2-up', onePage, 0)
    expect(oneFrames).toHaveLength(2)

    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const frames = generateTemplateFrames('2-up', book, 1)
    expect(frames).toHaveLength(2)
    const W = book.settings.trim.widthMm * 2
    const m = book.layoutGrid.margins
    const cg = book.layoutGrid.columnGutterMm
    const contentW = W - m.left - m.right
    const colW = (contentW - cg) / 2
    expect(frames[0]?.rect).toEqual({
      x: m.left,
      y: m.top,
      width: colW,
      height: book.settings.trim.heightMm - m.top - m.bottom,
    })
    expect(frames[1]?.rect.x).toBeCloseTo(m.left + colW + cg)
    expect(frames[1]?.rect.width).toBeCloseTo(colW)
  })

  it('4-grid yields exact 2×2 cells in the margin box', () => {
    const book = makeBook({
      layoutGrid: {
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        columns: 2,
        rows: 2,
        columnGutterMm: 4,
        rowGutterMm: 6,
      },
      settings: { trim: { widthMm: 200, heightMm: 200 } },
    })
    const frames = generateTemplateFrames('4-grid', book, 0)
    expect(frames).toHaveLength(4)
    expect(frames.map((frame) => frame.z)).toEqual([0, 1, 2, 3])
    expect(frames[0]?.rect).toEqual({ x: 10, y: 10, width: 88, height: 87 })
    expect(frames[1]?.rect).toEqual({ x: 102, y: 10, width: 88, height: 87 })
    expect(frames[2]?.rect).toEqual({ x: 10, y: 103, width: 88, height: 87 })
    expect(frames[3]?.rect).toEqual({ x: 102, y: 103, width: 88, height: 87 })
  })

  it('4-grid on interior spread uses double width', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const frames = generateTemplateFrames('4-grid', book, 1)
    expect(frames).toHaveLength(4)
    const W = book.settings.trim.widthMm * 2
    const m = book.layoutGrid.margins
    const cg = book.layoutGrid.columnGutterMm
    const contentW = W - m.left - m.right
    const cellW = (contentW - cg) / 2
    expect(frames[0]?.rect.width).toBeCloseTo(cellW)
    expect(frames[3]?.rect.x).toBeCloseTo(m.left + cellW + cg)
  })
})

describe('applyTemplate', () => {
  it('keeps placements by index and preserves frame ids', () => {
    const book = makeBook({
      assets: { a: {}, b: {} },
      gallery: ['a', 'b'],
      spreads: [
        makeSpread({
          id: 's1',
          frames: [
            makeFrame({
              id: 'keep-me',
              assetId: 'a',
              crop: { zoom: 1.2, center: { x: 0.4, y: 0.6 } },
            }),
            makeFrame({ id: 'second', assetId: 'b' }),
          ],
        }),
      ],
    })
    const next = applyTemplate(book, 's1', '4-grid')
    const spread = next.spreads[0]
    expect(spread?.templateId).toBe('4-grid')
    expect(spread?.frames).toHaveLength(4)
    expect(spread?.frames[0]?.id).toBe('keep-me')
    expect(spread?.frames[0]?.assetId).toBe('a')
    expect(spread?.frames[0]?.crop).toEqual({
      zoom: 1.2,
      center: { x: 0.4, y: 0.6 },
    })
    expect(spread?.frames[1]?.id).toBe('second')
    expect(spread?.frames[1]?.assetId).toBe('b')
    expect(spread?.frames[2]?.assetId).toBeUndefined()
    expect(spread?.frames[2]?.id).toMatch(/^s1-f/)
  })

  it('is a no-op when re-applying the same template with same frames', () => {
    const book = applyTemplate(makeBook(), 'spread-1', '2-up')
    const again = applyTemplate(book, 'spread-1', '2-up')
    expect(again).toBe(book)
    expect(again.spreads[0]).toBe(book.spreads[0])
  })

  it('returns the same book for unknown spread id', () => {
    const book = makeBook()
    expect(applyTemplate(book, 'missing', '2-up')).toBe(book)
  })
})
