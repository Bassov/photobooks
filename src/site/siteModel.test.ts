import { describe, expect, it } from 'vitest'
import { pagesOf } from '../core/pages'
import {
  bookMeta,
  frameSizes,
  hashForSlide,
  homeHead,
  homeLead,
  isNarrow,
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
    expect([0, 1, 2, 11].map(pagesOf)).toStrictEqual([0, 1, 2, 20])
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

  it.each([
    [1440, 600, 262.85],
    [390, 600, 258.85],
  ])(
    'gives the All books row to the stage without it (%i × %i: chrome %f)',
    (vw, vh, chrome) => {
      const ratio = 1
      const w = stageWidth({ vw, vh, ratio, allBooks: false })

      expect(w).toBeCloseTo((vh - chrome) * ratio, 6)
      expect(stageWidth({ vw, vh, ratio, allBooks: true })).toBeCloseTo(
        (vh - chrome - 36) * ratio,
        6,
      )
    },
  )

  it('fills 760 exactly at the height that leaves 760 without All books', () => {
    const vh = 262.85 + 760 / KIT_RATIO

    expect(
      stageWidth({ vw: 1440, vh, ratio: KIT_RATIO, allBooks: false }),
    ).toBeCloseTo(760, 6)
    expect(
      stageWidth({ vw: 1440, vh: vh - 1, ratio: KIT_RATIO, allBooks: false }),
    ).toBeLessThan(760)
    expect(stageWidth({ vw: 1440, vh, ratio: KIT_RATIO })).toBeLessThan(760)
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

  it('heads the home with the author, else the site title (D37)', () => {
    expect(homeHead({ title: 'Site', author: ' Alex ' })).toBe('Alex')
    expect(homeHead({ title: 'Site', author: '  ' })).toBe('Site')
    expect(homeHead({ title: '' })).toBe('Photobooks')
  })

  it('leads with the intro, else Photobooks by the author, else none (D37)', () => {
    expect(homeLead({ author: 'Alex', intro: ' Lakes. ' })).toBe('Lakes.')
    expect(homeLead({ author: 'Alex', intro: ' ' })).toBe('Photobooks by Alex.')
    expect(homeLead({ author: ' ' })).toBeUndefined()
    expect(homeLead({})).toBeUndefined()
  })

  it('writes the book meta line', () => {
    expect(bookMeta('Alex', 20)).toBe('by Alex · 20 pages')
    expect(bookMeta('', 20)).toBe('20 pages')
  })
})
