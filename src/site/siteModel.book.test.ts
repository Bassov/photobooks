import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import type { Book, Frame } from '../core'
import { defaultCover } from '../core/cover'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  relativeLuminance,
  roomSlides,
  siteBookFacts,
  siteSlides,
  slideOfView,
} from './siteModel'

/** Default fixture trim: 300 × 300 mm pages. */
const PAGE = 300

function bookWith(patch: {
  backFill?: string
  spine?: string
  title?: string
}) {
  const cover = defaultCover(patch.title ?? 'Lake')
  return makeBook({
    title: patch.title ?? 'Lake',
    settings: { trim: { widthMm: 210, heightMm: 297 } },
    cover: {
      ...cover,
      spine: { text: patch.spine ?? cover.spine.text },
      style: { ...cover.style, backFill: patch.backFill ?? '#3e3c3b' },
    },
    spreads: [makeSpread(), makeSpread(), makeSpread()],
  })
}

const at = (x: number, width = 100, id = `f${String(x)}`): Frame =>
  makeFrame({ id, rect: { x, y: 10, width, height: 100 } })

function spreadsBook(frames: Frame[][]): Book {
  return makeBook({
    spreads: frames.map((list, i) =>
      makeSpread({ id: `s${String(i)}`, frames: list }),
    ),
  })
}

describe('siteBookFacts (D38)', () => {
  it('maps trim, UTC year, 2(n − 1) pages, spine, paper and endpaper', () => {
    // 2024-12-31 23:30 UTC is already 2025 east of UTC: the year is UTC's.
    const facts = siteBookFacts(bookWith({}), Date.UTC(2024, 11, 31, 23, 30))

    expect(facts).toStrictEqual({
      year: 2024,
      trimMm: { w: 210, h: 297 },
      pageCount: 4,
      spine: { cloth: '#3e3c3b', ink: '#F1F3F6', text: 'Lake' },
      paper: '#FBFAF7',
      endpaper: '#E9E4DA',
    })
    expect(siteBookFacts(bookWith({}), Date.UTC(2025, 0, 1)).year).toBe(2025)
  })

  it('uses the book page colour as paper', () => {
    const book = makeBook({ settings: { pageColor: '#f7f4ee' } })

    expect(siteBookFacts(book, 0).paper).toBe('#f7f4ee')
  })

  it('falls back to the title for an empty spine text', () => {
    expect(siteBookFacts(bookWith({ spine: '  ' }), 0).spine.text).toBe('Lake')
    expect(
      siteBookFacts(bookWith({ spine: 'Lake · 2024' }), 0).spine.text,
    ).toBe('Lake · 2024')
    expect(
      siteBookFacts(bookWith({ spine: '', title: ' ' }), 0).spine.text,
    ).toBe('Untitled book')
  })

  it('switches the spine ink at a cloth luminance of 0.23', () => {
    // #838383 → 0.2232, #858585 → 0.2307: one step either side of 0.23.
    expect(relativeLuminance('#838383')).toBeLessThan(0.23)
    expect(relativeLuminance('#858585')).toBeGreaterThan(0.23)
    expect(siteBookFacts(bookWith({ backFill: '#838383' }), 0).spine.ink).toBe(
      '#F1F3F6',
    )
    expect(siteBookFacts(bookWith({ backFill: '#858585' }), 0).spine.ink).toBe(
      '#2E2C2D',
    )
  })

  it('measures luminance per WCAG', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 10)
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 10)
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 10)
    expect(relativeLuminance('#0a0a0a')).toBeCloseTo(10 / 255 / 12.92, 10)
  })

  test.prop([fc.integer({ min: 0, max: 0xffffff })], { numRuns: 500 })(
    'ink is light exactly when the cloth is darker than 0.23',
    (rgb) => {
      const cloth = `#${rgb.toString(16).padStart(6, '0')}`
      const { ink } = siteBookFacts(bookWith({ backFill: cloth }), 0).spine
      expect(ink === '#F1F3F6').toBe(relativeLuminance(cloth) < 0.23)
    },
  )
})

describe('siteSlides (D40)', () => {
  it('gives each page with a frame its own slide', () => {
    const book = spreadsBook([[at(10)], [at(10), at(PAGE + 10)], [at(10)]])

    expect(siteSlides(book)).toStrictEqual([
      { spread: 0, side: 'right' },
      { spread: 1, side: 'left' },
      { spread: 1, side: 'right' },
      { spread: 2, side: 'left' },
    ])
  })

  it('skips blank pages, including frames off the page', () => {
    const offPage = makeFrame({
      id: 'below',
      rect: { x: 10, y: PAGE, width: 50, height: 50 },
    })
    const above = makeFrame({
      id: 'above',
      rect: { x: PAGE + 10, y: -50, width: 50, height: 50 },
    })
    const book = spreadsBook([
      [],
      [at(PAGE + 10), offPage, at(-120)],
      [at(10), above],
      [at(PAGE), offPage],
    ])

    expect(siteSlides(book)).toStrictEqual([
      { spread: 1, side: 'right' },
      { spread: 2, side: 'left' },
    ])
  })

  it('keeps a spread whole when a frame crosses the gutter', () => {
    const book = spreadsBook([
      [at(10)],
      [at(PAGE - 1, 2)],
      [at(0, PAGE), at(PAGE, PAGE)],
      [at(10)],
    ])

    expect(siteSlides(book)).toStrictEqual([
      { spread: 0, side: 'right' },
      { spread: 1, side: 'both' },
      { spread: 2, side: 'left' },
      { spread: 2, side: 'right' },
      { spread: 3, side: 'left' },
    ])
  })

  it('counts parent frames', () => {
    const book = {
      ...spreadsBook([[], [], []]),
      parents: [
        {
          id: 'p',
          name: 'P',
          frames: [at(PAGE + 10)],
          guides: [],
        },
      ],
      defaultParentId: 'p',
    }

    expect(siteSlides(book)).toStrictEqual([{ spread: 1, side: 'right' }])
  })

  test.prop(
    [
      fc.array(
        fc.array(
          fc.record({
            x: fc.integer({ min: -100, max: 2 * PAGE }),
            width: fc.integer({ min: 1, max: 2 * PAGE }),
          }),
          { maxLength: 3 },
        ),
        { minLength: 2, maxLength: 8 },
      ),
    ],
    { numRuns: 300 },
  )('a page never shows twice and slides follow the spreads', (layout) => {
    const book = spreadsBook(
      layout.map((frames) => frames.map(({ x, width }) => at(x, width))),
    )
    const slides = siteSlides(book)
    const keys = slides.map(({ spread, side }) => `${String(spread)}${side}`)
    expect(new Set(keys).size).toBe(keys.length)
    const order = slides.map(({ spread }) => spread)
    expect(order).toStrictEqual(order.toSorted((a, b) => a - b))
    for (const slide of slides) {
      const both = slides.filter((s) => s.spread === slide.spread)
      expect(both.length === 1 || both.every((s) => s.side !== 'both')).toBe(
        true,
      )
    }
  })
})

describe('roomSlides (D40)', () => {
  const book = spreadsBook([
    [at(10)],
    [at(PAGE - 1, 2)],
    [at(10), at(PAGE + 10)],
    [],
    [at(10)],
  ])

  it('opens on the cover, then labels pages and whole spreads of the book', () => {
    expect(
      roomSlides(book).map(({ view, label }) => [view, label]),
    ).toStrictEqual([
      [0, 'Cover'],
      [1, 'Page 1 of 8'],
      [2, 'Pages 2–3 of 8'],
      [3, 'Page 4 of 8'],
      [3, 'Page 5 of 8'],
      [5, 'Page 8 of 8'],
    ])
    expect(roomSlides(book)[3]?.page).toStrictEqual({ spread: 2, side: 'left' })
  })

  it('finds the first slide of a view; a blank spread opens the next one', () => {
    const slides = roomSlides(book)

    expect([0, 1, 3, 4, 5, 6].map((v) => slideOfView(slides, v))).toStrictEqual(
      [0, 1, 3, 5, 5, 5],
    )
  })
})
