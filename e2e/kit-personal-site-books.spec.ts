import { expect, test } from './fixtures/coverage'
import {
  CLOTH,
  siteBookOf,
  siteBooksOf,
  spineInkOf,
} from '../uikit/src/demo-parts/siteBooks'

// personal-site D38 (K2): the kit #/demo session's books → the site's books. Pure adapter, no page.

const O = { year: 2026, templates: ['t-full', 't-two'] }
const frame = (photo: string | null) => ({ kind: 'image' as const, photo })
const text = { kind: 'text' as const, photo: null }
const spread = (template: string | null, photos: (string | null)[]) => ({
  template,
  frames: [text, ...photos.map(frame)],
})
const book = (id: string, spreads: ReturnType<typeof spread>[]) => ({
  id,
  title: id.toUpperCase(),
  book: { w: 14.8, h: 21 },
  doc: { spreads },
})

test.describe('siteBooks adapter (D38)', () => {
  test('a book: 2(n − 1) pages, spreads after the title spread, the last one a single page, unknown templates → t-full', () => {
    const b = siteBookOf(
      book('lake', [
        spread('t-full', ['p0']),
        spread('t-two', ['p1', 'p2']),
        spread('t-mosaic', [null, 'p3', 'p4']),
        spread('t-two', ['p5', 'p6']),
      ]),
      O,
    )
    expect(b).toMatchObject({
      id: 'lake',
      title: 'LAKE',
      year: 2026,
      fmt: 'portrait',
      cover: 'p0',
      w: 14.8,
      h: 21,
      pages: 6,
      spine: CLOTH,
      spineInk: spineInkOf(CLOTH),
    })
    expect(b.spreads).toEqual([
      { template: 't-two', photos: ['p1', 'p2'] },
      { template: 't-full', photos: ['p3'] },
      { template: 'last', photos: ['p5'] },
    ])
  })

  test('format, cover fallbacks and an empty doc', () => {
    const wide = { ...book('w', []), book: { w: 21, h: 14.8 } }
    expect(siteBookOf(wide, O)).toMatchObject({
      fmt: 'landscape',
      pages: 0,
      spreads: [],
      cover: '',
    })
    const sq = { ...book('s', []), book: { w: 20, h: 20 } }
    expect(siteBookOf(sq, O).fmt).toBe('square')
    const later = book('c', [spread(null, [null]), spread('t-full', ['p9'])])
    expect(siteBookOf(later, O).cover).toBe('p9')
    expect(siteBookOf({ ...later, extras: { cover: 'own' } }, O).cover).toBe(
      'own',
    )
    expect(siteBookOf({ ...later, doc: undefined }, O).pages).toBe(0)
  })

  test('only published books, in session order', () => {
    const books = [
      { ...book('a', []), published: true },
      { ...book('b', []), published: false },
      book('c', []),
      { ...book('d', []), published: true },
    ]
    expect(siteBooksOf(books, O).map((b) => b.id)).toEqual(['a', 'd'])
  })

  test('spine ink: light on a dark cloth, dark on a light one', () => {
    expect(spineInkOf('#353332')).toBe('#F1F3F6')
    expect(spineInkOf('#f0f0f0')).toBe('#2E2C2D')
  })
})
