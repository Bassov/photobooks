import { describe, expect, it } from 'vitest'
import { applyTemplate, generateTemplateFrames, isTemplateId } from '../index'
import {
  makeBook,
  makeFrame,
  makePlacedTemplateBook,
  makeSpread,
} from '../testing/fixtures'

describe('isTemplateId', () => {
  it('accepts catalog ids and rejects others', () => {
    expect(isTemplateId('full-bleed')).toBe(true)
    expect(isTemplateId('one-per-page')).toBe(true)
    expect(isTemplateId('2-up')).toBe(true)
    expect(isTemplateId('4-grid')).toBe(true)
    expect(isTemplateId('hero-grid')).toBe(true)
    expect(isTemplateId('offset-pair')).toBe(true)
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
      x: m.inside,
      y: m.top,
      width: W - m.inside - m.outside,
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
    expect(frames[0]?.rect.x).toBe(m.outside)
    expect(frames[0]?.rect.width).toBe(pageW - m.inside - m.outside)
    expect(frames[1]?.rect.x).toBe(pageW + m.inside)
    expect(frames[1]?.rect.width).toBe(pageW - m.inside - m.outside)
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
    const contentW = W - 2 * m.outside
    const colW = (contentW - cg) / 2
    expect(frames[0]?.rect).toEqual({
      x: m.outside,
      y: m.top,
      width: colW,
      height: book.settings.trim.heightMm - m.top - m.bottom,
    })
    expect(frames[1]?.rect.x).toBeCloseTo(m.outside + colW + cg)
    expect(frames[1]?.rect.width).toBeCloseTo(colW)
  })

  it('4-grid yields exact 2×2 cells in the margin box', () => {
    const book = makeBook({
      layoutGrid: {
        margins: { top: 10, bottom: 10, inside: 10, outside: 10 },
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

  describe('kit layouts on a one-page spread (halves = content split by the gutter)', () => {
    // 200×200 page, 10 mm margins: content 180×180; halves 88 wide at x 10 / 102.
    const book = makeBook({
      layoutGrid: {
        margins: { top: 10, bottom: 10, inside: 10, outside: 10 },
        columns: 2,
        rows: 2,
        columnGutterMm: 4,
        rowGutterMm: 6,
      },
      settings: { trim: { widthMm: 200, heightMm: 200 } },
    })
    const rects = (id: Parameters<typeof generateTemplateFrames>[0]) =>
      generateTemplateFrames(id, book, 0).map((frame) => frame.rect)
    const left = { x: 10, y: 10, width: 88, height: 180 }
    const right = { x: 102, y: 10, width: 88, height: 180 }

    it('hero-two: left half plus the right half in two rows', () => {
      expect(rects('hero-two')).toEqual([
        left,
        { x: 102, y: 10, width: 88, height: 87 },
        { x: 102, y: 103, width: 88, height: 87 },
      ])
    })

    it('hero-grid: left half plus a 2×2 grid in the right half', () => {
      expect(rects('hero-grid')).toEqual([
        left,
        { x: 102, y: 10, width: 42, height: 87 },
        { x: 148, y: 10, width: 42, height: 87 },
        { x: 102, y: 103, width: 42, height: 87 },
        { x: 148, y: 103, width: 42, height: 87 },
      ])
    })

    it('panorama: a centered 7:2 frame across the content box', () => {
      const [pano, ...rest] = rects('panorama')
      expect(rest).toEqual([])
      expect(pano?.x).toBe(10)
      expect(pano?.width).toBe(180)
      expect(pano?.height).toBeCloseTo(180 / 3.5)
      expect(pano?.y).toBeCloseTo(10 + (180 - 180 / 3.5) / 2)
    })

    it('three-across: three centered squares in gutter-separated columns', () => {
      const cells = rects('three-across')
      const side = (180 - 2 * 4) / 3
      expect(cells).toHaveLength(3)
      cells.forEach((cell, i) => {
        expect(cell.x).toBeCloseTo(10 + i * (side + 4))
        expect(cell.width).toBeCloseTo(side)
        expect(cell.height).toBeCloseTo(side)
        expect(cell.y).toBeCloseTo(10 + (180 - side) / 2)
      })
    })

    it('framed-single: the right half', () => {
      expect(rects('framed-single')).toEqual([right])
    })

    it('offset-pair: top 70% of the left half, bottom 70% of the right', () => {
      const [top, bottom, ...rest] = rects('offset-pair')
      expect(rest).toEqual([])
      expect(top).toMatchObject({ x: 10, y: 10, width: 88 })
      expect(top?.height).toBeCloseTo(126)
      expect(bottom).toMatchObject({ x: 102, width: 88 })
      expect(bottom?.y).toBeCloseTo(64)
      expect(bottom?.height).toBeCloseTo(126)
    })
  })

  it('kit layouts stay inside the content box without overlaps on both spread kinds', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const m = book.layoutGrid.margins
    const H = book.settings.trim.heightMm
    const counts = {
      'hero-two': 3,
      'hero-grid': 5,
      panorama: 1,
      'three-across': 3,
      'framed-single': 1,
      'offset-pair': 2,
    } as const
    for (const spreadIndex of [0, 1]) {
      const W = book.settings.trim.widthMm * (spreadIndex === 1 ? 2 : 1)
      for (const [id, count] of Object.entries(counts)) {
        const frames = generateTemplateFrames(
          id as keyof typeof counts,
          book,
          spreadIndex,
        )
        expect(frames, id).toHaveLength(count)
        for (const { rect } of frames) {
          expect(rect.x).toBeGreaterThanOrEqual(Math.min(m.inside, m.outside))
          expect(rect.y).toBeGreaterThanOrEqual(m.top)
          expect(rect.x + rect.width).toBeLessThanOrEqual(
            W - Math.min(m.inside, m.outside) + 1e-9,
          )
          expect(rect.y + rect.height).toBeLessThanOrEqual(H - m.bottom + 1e-9)
        }
        frames.forEach((a, i) => {
          frames.slice(i + 1).forEach((b) => {
            const apart =
              a.rect.x + a.rect.width <= b.rect.x + 1e-9 ||
              b.rect.x + b.rect.width <= a.rect.x + 1e-9 ||
              a.rect.y + a.rect.height <= b.rect.y + 1e-9 ||
              b.rect.y + b.rect.height <= a.rect.y + 1e-9
            expect(apart, `${id} ${a.id}/${b.id}`).toBe(true)
          })
        })
      }
    }
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
    const contentW = W - 2 * m.outside
    const cellW = (contentW - cg) / 2
    expect(frames[0]?.rect.width).toBeCloseTo(cellW)
    expect(frames[3]?.rect.x).toBeCloseTo(m.outside + cellW + cg)
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

  it('keeps slotted asset ids and leaves overflow ids in the gallery', () => {
    const book = makePlacedTemplateBook('4-grid', ['a', 'b', 'c', 'd'])

    const next = applyTemplate(book, 'spread-1', 'one-per-page')

    expect(next.spreads[0]?.frames.map((frame) => frame.assetId)).toEqual(['a'])
    expect(next.gallery).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns the same book for unknown spread id', () => {
    const book = makeBook()
    expect(applyTemplate(book, 'missing', '2-up')).toBe(book)
  })
})
