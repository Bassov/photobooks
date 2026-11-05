import { describe, expect, it } from 'vitest'
import {
  bookMeta,
  bookObjectHeight,
  catalogColumns,
  catalogColumnWidth,
  catalogMeta,
  frameSizes,
  hashForSlide,
  isNarrow,
  sitePageCount,
  siteTitle,
  slideCount,
  slideForHash,
  slideLabel,
  spreadRatio,
  stageWidth,
} from './siteModel'

/** Kit book: 760 × 460 spread. */
const KIT_RATIO = 760 / 460

describe('slides', () => {
  it('counts the cover plus every spread', () => {
    expect(slideCount(11)).toBe(12)
  })

  it('labels the cover, single pages and page pairs with the spread counter', () => {
    const labels = Array.from({ length: 12 }, (_, s) => slideLabel(s, 11))

    expect(labels.slice(0, 3)).toStrictEqual([
      'Cover',
      'Page 1 · 1 / 11',
      'Pages 2–3 · 2 / 11',
    ])
    expect(labels[11]).toBe('Page 20 · 11 / 11')
  })

  it('counts the pages a visitor sees', () => {
    expect([0, 1, 2, 11].map(sitePageCount)).toStrictEqual([0, 1, 2, 20])
  })
})

describe('hash', () => {
  it('puts the first page of the spread in the hash; the cover has none', () => {
    expect([0, 1, 2, 3, 11, 12].map((s) => hashForSlide(s, 11))).toStrictEqual([
      '',
      '#p1',
      '#p2',
      '#p4',
      '#p20',
      '',
    ])
  })

  it('opens the spread holding the page, else the cover', () => {
    expect(slideForHash('#p6', 11)).toBe(4)
    expect(slideForHash('#p7', 11)).toBe(4)
    expect(slideForHash('#p1', 11)).toBe(1)
    expect(slideForHash('#p20', 11)).toBe(11)
    for (const hash of [
      '',
      '#p0',
      '#p21',
      '#p01',
      '#x6',
      '#p6x',
      '#p-1',
      'x#p6',
    ]) {
      expect(slideForHash(hash, 11)).toBe(0)
    }
  })
})

describe('layout', () => {
  it('is narrow below 768', () => {
    expect([767, 768].map(isNarrow)).toStrictEqual([true, false])
  })

  it('picks catalog columns by content width', () => {
    expect([939, 940, 679, 680].map(catalogColumns)).toStrictEqual([3, 4, 2, 3])
  })

  it.each([
    [1440, 235],
    [1024, 216],
    [768, 640 / 3],
    [390, 165],
  ])('catalog column at %i is %d wide', (vw, col) => {
    expect(catalogColumnWidth(vw)).toBeCloseTo(col, 6)
  })

  it('sizes the book object to the column, at most 200 tall', () => {
    expect(bookObjectHeight(235, 'portrait')).toBe(200)
    expect(bookObjectHeight(235, 'landscape')).toBe(188)
    expect(bookObjectHeight(165, 'square')).toBe(165)
  })

  it.each([
    [1440, 900, 760],
    [1024, 768, 760],
    [768, 1024, 704],
    [390, 844, 350],
    [320, 568, 280],
  ])('stage at %i × %i is %i wide', (vw, vh, w) => {
    expect(stageWidth({ vw, vh, ratio: KIT_RATIO })).toBe(w)
  })

  it('keeps the stage inside the height left on a short viewport', () => {
    const w = stageWidth({ vw: 1440, vh: 600, ratio: KIT_RATIO })

    expect(w).toBeCloseTo((600 - 298.85) * KIT_RATIO, 6)
  })

  it('never makes the stage wider than the content', () => {
    expect(stageWidth({ vw: 300, vh: 900, ratio: KIT_RATIO })).toBe(260)
  })

  it('takes the spread ratio from two trim pages', () => {
    expect(spreadRatio({ widthMm: 190, heightMm: 230 })).toBe(380 / 230)
  })

  it('writes sizes for both layouts from the frame share', () => {
    expect(frameSizes(0.5)).toBe(
      '(max-width: 767px) calc((100vw - 40px) * 0.5), min(380px, calc((100vw - 64px) * 0.5))',
    )
    expect(frameSizes(1 / 3)).toContain(
      'min(253px, calc((100vw - 64px) * 0.3333))',
    )
  })
})

describe('text', () => {
  it('falls back to Photobooks for an empty site title', () => {
    expect(siteTitle('  ')).toBe('Photobooks')
    expect(siteTitle('Alex')).toBe('Alex')
  })

  it('writes the catalog meta line', () => {
    expect(catalogMeta('Alex', 2)).toBe('Alex · 2 photobooks')
    expect(catalogMeta(undefined, 1)).toBe('1 photobook')
    expect(catalogMeta('', 2)).toBe('2 photobooks')
    expect(catalogMeta('Alex', 0)).toBe('No published books yet.')
  })

  it('writes the book meta line', () => {
    expect(bookMeta('Alex', 20)).toBe('by Alex · 20 pages')
    expect(bookMeta('', 20)).toBe('20 pages')
  })
})
