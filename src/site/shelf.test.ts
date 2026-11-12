import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import {
  capOf,
  caseLayout,
  faceW,
  hash,
  leanRoom,
  nextPattern,
  PLINTH,
  rowOf,
  shelfBook,
  shelve,
  spineW,
  thickCm,
  TOP,
  type CaseLayout,
  type Row,
  type ShelfBook,
} from './shelf'

const book = (id: string, over: Partial<ShelfBook> = {}): ShelfBook => ({
  id,
  title: id,
  year: 2024,
  pages: 20,
  w: 20,
  h: 25,
  cloth: '#334455',
  ink: '#F1F3F6',
  ...over,
})

const books = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
    minLength: 1,
    maxLength: 40,
  })
  .chain((ids) =>
    fc.tuple(
      ...ids.map((id) =>
        fc
          .record({
            pages: fc.integer({ min: 2, max: 200 }),
            w: fc.double({ min: 12, max: 35, noNaN: true }),
            h: fc.double({ min: 12, max: 35, noNaN: true }),
          })
          .map((r) => book(id, r)),
      ),
    ),
  )

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** a row as compact lines: every item's book, kind, box, lean and pivot */
const pin = (row: Row) => ({
  p: row.p,
  width: r3(row.width),
  height: r3(row.height),
  items: row.items.map(
    (it) =>
      `${it.b.id} ${it.kind} x${String(r3(it.x))} w${String(r3(it.w))} h${String(r3(it.h))} y${String(r3(it.y))} ${String(it.lean)}${it.origin ?? ''}`,
  ),
})

/** a case as compact lines: scale, size, and per row its top, pattern and item x */
const pinCase = (c: CaseLayout) => ({
  phone: c.phone,
  z: r3(c.z),
  s: r3(c.s),
  width: r3(c.width),
  height: r3(c.height),
  rows: c.rows.map(
    (r) =>
      `top${String(r3(r.top))} P${String(r.p)} w${String(r3(r.width))} h${String(r3(r.height))} | ${r.items.map((it) => `${it.b.id}@${String(r3(it.x))}`).join(' ')}`,
  ),
})

/** first face-out, then spines of distinct thickness and height (thinnest: s4 at the 24·z floor, then s2) */
const seven = [
  book('f', { w: 24, h: 30 }),
  book('s1', { pages: 40, h: 28 }),
  book('s2', { pages: 10, h: 22 }),
  book('s3', { pages: 80, h: 26 }),
  book('s4', { pages: 2, h: 20 }),
  book('s5', { pages: 60, h: 24 }),
  book('s6', { pages: 30, h: 29 }),
]

const sample = () => {
  const input = sampleSiteInput('')
  if (input.kind !== 'catalog') throw new Error('catalog expected')
  return input.books.map(shelfBook)
}

describe('shelf', () => {
  it('reads the site facts: trim in cm, the spine cloth and ink', () => {
    expect(sample()[0]).toStrictEqual({
      id: 'alps',
      title: 'Alps',
      year: 2024,
      pages: 20,
      w: 19,
      h: 23,
      cloth: '#3e3c3b',
      ink: '#F1F3F6',
    })
  })

  it('sizes spines from the GL thickness with a 24 px floor, faces from the trim', () => {
    const b = book('a')
    expect(thickCm(b)).toBeCloseTo(1.7, 9)
    expect(spineW(b, 10, 1)).toBeCloseTo(40.8, 9)
    expect(spineW(book('a', { pages: 2 }), 2, 1.5)).toBe(36)
    expect(faceW(b, 10, 1.5)).toBe(212)
  })

  it('hashes ids without periodic patterns and caps shelves at 9…13', () => {
    expect(hash('book-13')).not.toBe(hash('book-14'))
    expect(hash('a')).toBe(hash('a'))
    for (const id of ['a', 'b', 'c', 'book-13', 'book-14']) {
      expect(capOf(book(id))).toBeGreaterThanOrEqual(9)
      expect(capOf(book(id))).toBeLessThanOrEqual(13)
    }
  })

  it('leans a spine onto a shorter neighbour at its top', () => {
    const { yc, room } = leanRoom(30, 250, 200, 12)
    expect(yc).toBe(200)
    expect(room).toBeCloseTo(200 * Math.tan(0.2094395) - 2 + 30 * 0.9781476, 4)
    expect(leanRoom(30, 100, 200, 12).yc).toBeCloseTo(100 * 0.9781476, 4)
  })

  it('starts on P0, then picks a pattern unlike the two shelves above', () => {
    expect(nextPattern([], book('a'))).toBe(0)
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect([0, 3]).not.toContain(nextPattern([0, 3], book(id)))
    }
  })

  it('lays out an empty row as nothing', () => {
    expect(rowOf([], 1, 10, 1, 500)).toStrictEqual({
      items: [],
      width: 0,
      height: 0,
      p: 1,
    })
  })

  it.each([0, 1, 2, 3] as const)(
    'puts every book of a 7-book P%i row in it once, the first face-out',
    (p) => {
      const r = Array.from({ length: 7 }, (_, i) => book(`b${String(i)}`))
      const row = rowOf(r, p, 9, 1, 900)
      expect(row.items.map((it) => it.b.id).sort()).toStrictEqual(
        r.map((b) => b.id).sort(),
      )
      expect(row.items.find((it) => it.kind === 'face')?.b.id).toBe('b0')
      expect(row.height).toBe(25 * 9 + 40)
      // P1 and P3 lay two books flat
      expect(row.items.filter((it) => it.kind === 'flat')).toHaveLength(
        [0, 2, 0, 2][p] ?? -1,
      )
      // P1 is the one pattern without a leaning book
      expect(row.items.some((it) => it.lean !== 0)).toBe(p !== 1)
    },
  )

  it('pins hash values, caps and the next pattern from the last two shelves only', () => {
    const ids = ['', 'a', 'b', 'c', 'd', 'e', 'f', 'book-13', 'book-14']
    expect(ids.map(hash)).toMatchInlineSnapshot(`
      [
        2872998923,
        444641715,
        2193908274,
        1185767313,
        3417950254,
        2111704691,
        3736780160,
        3156887287,
        727966912,
      ]
    `)
    expect(ids.map((id) => capOf(book(id)))).toMatchInlineSnapshot(`
      [
        12,
        9,
        13,
        12,
        13,
        10,
        9,
        11,
        11,
      ]
    `)
    expect(ids.map((id) => nextPattern([0, 1, 2], book(id))))
      .toMatchInlineSnapshot(`
      [
        3,
        3,
        0,
        3,
        0,
        3,
        0,
        3,
        0,
      ]
    `)
    expect(ids.map((id) => nextPattern([2, 0], book(id))))
      .toMatchInlineSnapshot(`
      [
        3,
        3,
        1,
        3,
        1,
        3,
        1,
        3,
        1,
      ]
    `)
  })

  it('pins spine and face widths on both sides of the 24·z floor', () => {
    expect([
      thickCm(book('a', { pages: 2 })),
      thickCm(book('a', { pages: 100 })),
      spineW(book('a', { pages: 2 }), 13.5, 1.5),
      spineW(book('a', { pages: 10 }), 13.5, 1.5),
      spineW(book('a', { pages: 100 }), 9, 1),
      faceW(book('a', { w: 24 }), 13.5, 1.5),
    ]).toMatchInlineSnapshot(`
      [
        0.8,
        5.7,
        36,
        38.88,
        123.12,
        336,
      ]
    `)
  })

  it('pins the lean room for a shorter and a taller neighbour', () => {
    expect([leanRoom(36, 405, 300, 10), leanRoom(36, 300, 405, 14)])
      .toMatchInlineSnapshot(`
      [
        {
          "room": 86.35117332097897,
          "yc": 300,
        },
        {
          "room": 105.5072148258362,
          "yc": 291.08871788279896,
        },
      ]
    `)
  })

  it('pins P0 rows: face · run · lean←, no lean under three books', () => {
    expect({
      seven: pin(rowOf(seven, 0, 13.5, 1.5, 0)),
      three: pin(rowOf(seven.slice(0, 3), 0, 13.5, 1.5, 0)),
      two: pin(rowOf(seven.slice(0, 2), 0, 13.5, 1.5, 0)),
      one: pin(rowOf(seven.slice(0, 1), 0, 13.5, 1.5, 0)),
    }).toMatchInlineSnapshot(`
      {
        "one": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
          ],
          "p": 0,
          "width": 336,
        },
        "seven": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x336 w87.48 h378 y0 0",
            "s2 spine x424.48 w38.88 h297 y0 0",
            "s3 spine x464.36 w152.28 h351 y0 0",
            "s4 spine x617.64 w36 h270 y0 0",
            "s5 spine x654.64 w119.88 h324 y0 0",
            "s6 spine x829.65 w71.28 h391.5 y0 -10l",
          ],
          "p": 0,
          "width": 899.847,
        },
        "three": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x336 w87.48 h378 y0 0",
            "s2 spine x473.054 w38.88 h297 y0 -10l",
          ],
          "p": 0,
          "width": 511.343,
        },
        "two": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x336 w87.48 h378 y0 0",
          ],
          "p": 0,
          "width": 424.48,
        },
      }
    `)
  })

  it('pins P2 rows: run · face · run · lean←, split from two upright spines', () => {
    expect({
      seven: pin(rowOf(seven, 2, 13.5, 1.5, 0)),
      four: pin(rowOf(seven.slice(0, 4), 2, 13.5, 1.5, 0)),
      three: pin(rowOf(seven.slice(0, 3), 2, 13.5, 1.5, 0)),
      two: pin(rowOf(seven.slice(0, 2), 2, 13.5, 1.5, 0)),
    }).toMatchInlineSnapshot(`
      {
        "four": {
          "height": 465,
          "items": [
            "s1 spine x0 w87.48 h378 y0 0",
            "f face x88.48 w336 h405 y0 0",
            "s2 spine x424.48 w38.88 h297 y0 0",
            "s3 spine x513.729 w152.28 h351 y0 -10l",
          ],
          "p": 2,
          "width": 663.696,
        },
        "seven": {
          "height": 465,
          "items": [
            "s1 spine x0 w87.48 h378 y0 0",
            "s2 spine x88.48 w38.88 h297 y0 0",
            "s3 spine x128.36 w152.28 h351 y0 0",
            "f face x281.64 w336 h405 y0 0",
            "s4 spine x617.64 w36 h270 y0 0",
            "s5 spine x654.64 w119.88 h324 y0 0",
            "s6 spine x829.65 w71.28 h391.5 y0 -10l",
          ],
          "p": 2,
          "width": 899.847,
        },
        "three": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x336 w87.48 h378 y0 0",
            "s2 spine x473.054 w38.88 h297 y0 -10l",
          ],
          "p": 2,
          "width": 511.343,
        },
        "two": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x336 w87.48 h378 y0 0",
          ],
          "p": 2,
          "width": 424.48,
        },
      }
    `)
  })

  it('pins P1 rows: the two thinnest flat from five spines, face at the right end', () => {
    expect({
      seven: pin(rowOf(seven, 1, 13.5, 1.5, 0)),
      sevenWide: pin(rowOf(seven, 1, 13.5, 1.5, 2000)),
      six: pin(rowOf(seven.slice(0, 6), 1, 13.5, 1.5, 0)),
      five: pin(rowOf(seven.slice(0, 5), 1, 13.5, 1.5, 0)),
      one: pin(rowOf(seven.slice(0, 1), 1, 13.5, 1.5, 0)),
    }).toMatchInlineSnapshot(`
      {
        "five": {
          "height": 465,
          "items": [
            "s1 spine x0 w87.48 h378 y0 0",
            "s2 spine x88.48 w38.88 h297 y0 0",
            "s3 spine x128.36 w152.28 h351 y0 0",
            "s4 spine x281.64 w36 h270 y0 0",
            "f face x353.64 w336 h405 y0 0",
          ],
          "p": 1,
          "width": 689.64,
        },
        "one": {
          "height": 465,
          "items": [
            "f face x35 w336 h405 y0 0",
          ],
          "p": 1,
          "width": 371,
        },
        "seven": {
          "height": 465,
          "items": [
            "s2 flat x0 w297 h38.88 y0 0",
            "s4 flat x0 w270 h36 y38.88 0",
            "s1 spine x300 w87.48 h378 y0 0",
            "s3 spine x388.48 w152.28 h351 y0 0",
            "s5 spine x541.76 w119.88 h324 y0 0",
            "s6 spine x662.64 w71.28 h391.5 y0 0",
            "f face x769.92 w336 h405 y0 0",
          ],
          "p": 1,
          "width": 1105.92,
        },
        "sevenWide": {
          "height": 465,
          "items": [
            "s2 flat x0 w297 h38.88 y0 0",
            "s4 flat x0 w270 h36 y38.88 0",
            "s1 spine x300 w87.48 h378 y0 0",
            "s3 spine x388.48 w152.28 h351 y0 0",
            "s5 spine x541.76 w119.88 h324 y0 0",
            "s6 spine x662.64 w71.28 h391.5 y0 0",
            "f face x1664 w336 h405 y0 0",
          ],
          "p": 1,
          "width": 1105.92,
        },
        "six": {
          "height": 465,
          "items": [
            "s2 flat x0 w297 h38.88 y0 0",
            "s4 flat x0 w270 h36 y38.88 0",
            "s1 spine x300 w87.48 h378 y0 0",
            "s3 spine x388.48 w152.28 h351 y0 0",
            "s5 spine x541.76 w119.88 h324 y0 0",
            "f face x697.64 w336 h405 y0 0",
          ],
          "p": 1,
          "width": 1033.64,
        },
      }
    `)
  })

  it('pins P3 rows: face · gap · lean→ · run · stack, right-aligned in a wide bay', () => {
    expect({
      seven: pin(rowOf(seven, 3, 13.5, 1.5, 0)),
      sevenWide: pin(rowOf(seven, 3, 13.5, 1.5, 2000)),
      five: pin(rowOf(seven.slice(0, 5), 3, 13.5, 1.5, 0)),
      fiveWide: pin(rowOf(seven.slice(0, 5), 3, 13.5, 1.5, 2000)),
      three: pin(rowOf(seven.slice(0, 3), 3, 13.5, 1.5, 0)),
      two: pin(rowOf(seven.slice(0, 2), 3, 13.5, 1.5, 0)),
    }).toMatchInlineSnapshot(`
      {
        "five": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s2 spine x508.52 w38.88 h297 y0 0",
            "s3 spine x548.4 w152.28 h351 y0 0",
            "s4 spine x701.68 w36 h270 y0 0",
            "s1 spine x370.671 w87.48 h378 y0 10r",
          ],
          "p": 3,
          "width": 737.68,
        },
        "fiveWide": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s2 spine x1770.84 w38.88 h297 y0 0",
            "s3 spine x1810.72 w152.28 h351 y0 0",
            "s4 spine x1964 w36 h270 y0 0",
            "s1 spine x1632.991 w87.48 h378 y0 10r",
          ],
          "p": 3,
          "width": 737.68,
        },
        "seven": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s2 flat x866.482 w297 h38.88 y0 0",
            "s4 flat x866.482 w270 h36 y38.88 0",
            "s3 spine x518.042 w152.28 h351 y0 0",
            "s5 spine x671.322 w119.88 h324 y0 0",
            "s6 spine x792.202 w71.28 h391.5 y0 0",
            "s1 spine x370.671 w87.48 h378 y0 10r",
          ],
          "p": 3,
          "width": 1163.482,
        },
        "sevenWide": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s2 flat x1703 w297 h38.88 y0 0",
            "s4 flat x1703 w270 h36 y38.88 0",
            "s3 spine x1354.56 w152.28 h351 y0 0",
            "s5 spine x1507.84 w119.88 h324 y0 0",
            "s6 spine x1628.72 w71.28 h391.5 y0 0",
            "s1 spine x1207.189 w87.48 h378 y0 10r",
          ],
          "p": 3,
          "width": 1163.482,
        },
        "three": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s2 spine x508.52 w38.88 h297 y0 0",
            "s1 spine x370.671 w87.48 h378 y0 10r",
          ],
          "p": 3,
          "width": 547.4,
        },
        "two": {
          "height": 465,
          "items": [
            "f face x0 w336 h405 y0 0",
            "s1 spine x372 w87.48 h378 y0 0",
          ],
          "p": 3,
          "width": 459.48,
        },
      }
    `)
  })

  it('leans with the angle picked by the first book', () => {
    const leans = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(
      (id) =>
        rowOf([book(id), ...seven.slice(1, 3)], 0, 9, 1, 0).items.at(-1)?.lean,
    )
    expect(leans).toMatchInlineSnapshot(`
      [
        -10,
        -14,
        -13,
        -14,
        -11,
        -10,
        -11,
      ]
    `)
  })

  it('fills shelves up to their cap when the bay is wide enough', () => {
    const thin = Array.from({ length: 40 }, (_, i) =>
      book(`t${String(i)}`, { pages: 2, w: 12 }),
    )
    const { rows, ps } = shelve(thin, 9, 1, 1e6)
    expect(rows.map((r) => r.length)).toMatchInlineSnapshot(`
      [
        12,
        11,
        12,
        5,
      ]
    `)
    expect(rows.map((r) => capOf(r[0] ?? book('none')))).toMatchInlineSnapshot(`
      [
        12,
        11,
        12,
        10,
      ]
    `)
    expect(ps).toMatchInlineSnapshot(`
      [
        0,
        1,
        3,
        2,
      ]
    `)
  })

  it('takes a book whose row width equals `avail` exactly, not one past it', () => {
    const bs = seven.slice(0, 3)
    const avail = rowOf(bs.slice(0, 2), 0, 9, 1, 0).width
    const ids = (a: number) =>
      shelve(bs, 9, 1, a).rows.map((r) => r.map((x) => x.id))
    expect(ids(avail)).toStrictEqual([['f', 's1'], ['s2']])
    expect(ids(avail - 1e-6)).toStrictEqual([['f'], ['s1', 's2']])
  })

  test.prop([books, fc.double({ min: 300, max: 1400, noNaN: true })])(
    'shelves every book once, in order; rows fit `avail` under their cap; patterns differ from the two above',
    (bs, avail) => {
      const { rows, ps } = shelve(bs, 9, 1, avail)
      expect(rows.flat()).toStrictEqual(bs)
      expect(ps).toHaveLength(rows.length)
      rows.forEach((r, i) => {
        const head = r[0]
        if (head === undefined) throw new Error('empty row')
        expect(r.length).toBeLessThanOrEqual(capOf(head))
        if (r.length > 1) {
          expect(rowOf(r, ps[i] ?? 0, 9, 1, 0).width).toBeLessThanOrEqual(avail)
        }
        expect(ps.slice(Math.max(0, i - 2), i)).not.toContain(ps[i])
      })
    },
  )
})

describe('caseLayout', () => {
  it.each([
    // one 30 cm shelf at 9 px/cm fits 1.69× under the lead: capped at 14/9
    [1440, 900, 1157.333333, 14 / 9],
    // short: s0 = 6, the shelf (18 + 180 + 40 + 40) fills 600 − 278.4
    [1280, 600, 1024, 321.6 / 278],
    [1920, 1080, 1430, 14 / 9],
    [390, 844, 358, 1],
  ])('at %i × %i the case is %d wide at z %d', (vw, vh, width, z) => {
    const c = caseLayout(sample(), vw, vh)
    expect(c.width).toBeCloseTo(width, 5)
    expect(c.z).toBeCloseTo(z, 9)
    expect(c.phone).toBe(vw <= 640)
  })

  it('stacks rows down the case: frame + shelves + plinth + row heights', () => {
    const c = caseLayout(sample(), 1440, 900)
    const [row] = c.rows
    expect(c.rows).toHaveLength(1)
    expect(row?.top).toBeCloseTo(TOP * c.z, 9)
    expect(c.height).toBeCloseTo((TOP + PLINTH) * c.z + (row?.height ?? 0), 9)
  })

  it('shrinks the phone scale until the widest face and two spines fit', () => {
    const w = book('w', { w: 60 })
    const c = caseLayout([w, book('x'), book('y')], 390, 844)
    expect(faceW(w, c.s, 1) + 50).toBeLessThanOrEqual(358 - 60)
    expect(c.s).toBeLessThan(9 * (844 / 900))
  })

  const many = Array.from({ length: 30 }, (_, i) =>
    book(`book-${String(i)}`, {
      pages: 10 + ((i * 37) % 150),
      w: 15 + ((i * 5) % 15),
      h: 18 + ((i * 7) % 15),
    }),
  )

  it('pins the sample case at desktop, short, wide and phone sizes', () => {
    expect({
      desktop: pinCase(caseLayout(sample(), 1440, 900)),
      short: pinCase(caseLayout(sample(), 1280, 600)),
      wide: pinCase(caseLayout(sample(), 2560, 1440)),
      phone: pinCase(caseLayout(sample(), 390, 844)),
      phoneEdge: pinCase(caseLayout(sample(), 640, 900)),
    }).toMatchInlineSnapshot(`
      {
        "desktop": {
          "height": 474.444,
          "phone": false,
          "rows": [
            "top28 P0 w401.596 h384.222 | alps@331.202 sea@609.646 lake@696.032",
          ],
          "s": 14,
          "width": 1157.333,
          "z": 1.556,
        },
        "phone": {
          "height": 292.12,
          "phone": true,
          "rows": [
            "top18 P0 w244.773 h234.12 | alps@0 sea@168.36 lake@221.137",
          ],
          "s": 8.44,
          "width": 358,
          "z": 1,
        },
        "phoneEdge": {
          "height": 305,
          "phone": true,
          "rows": [
            "top18 P0 w257.455 h247 | alps@0 sea@179 lake@233.82",
          ],
          "s": 9,
          "width": 608,
          "z": 1,
        },
        "short": {
          "height": 273.013,
          "phone": false,
          "rows": [
            "top20.823 P0 w219.551 h205.917 | alps@367.519 sea@508.653 lake@559.728",
          ],
          "s": 6.941,
          "width": 1024,
          "z": 1.157,
        },
        "wide": {
          "height": 474.444,
          "phone": false,
          "rows": [
            "top28 P0 w401.596 h384.222 | alps@467.535 sea@745.98 lake@832.365",
          ],
          "s": 14,
          "width": 1430,
          "z": 1.556,
        },
      }
    `)
  })

  it('pins a many-shelf case on desktop and phone', () => {
    expect({
      desktop: pinCase(caseLayout(many, 1440, 900)),
      tall: pinCase(caseLayout(many, 1366, 1200)),
      phone: pinCase(caseLayout(many, 390, 844)),
    }).toMatchInlineSnapshot(`
      {
        "desktop": {
          "height": 3601.111,
          "phone": false,
          "rows": [
            "top28 P0 w775.309 h510.222 | book-0@144.345 book-1@366.79 book-2@470.27 book-3@697.022",
            "top563.111 P3 w867.027 h496.222 | book-4@98.487 book-6@579.793 book-7@742.073 book-5@426.759",
            "top1084.222 P1 w875.538 h468.222 | book-9@94.231 book-10@190.991 book-11@349.911 book-8@607.324",
            "top1577.333 P2 w1012.475 h440.222 | book-13@25.763 book-14@119.163 book-12@274.723 book-15@497.167 book-16@765.451",
            "top2042.444 P3 w828.892 h510.222 | book-17@117.554 book-19@733.086 book-18@514.028",
            "top2577.556 P1 w845.298 h482.222 | book-21@109.351 book-22@196.031 book-23@344.871 book-20@592.204",
            "top3084.667 P2 w1059.459 h454.222 | book-25@2.27 book-26@85.59 book-24@231.07 book-27@453.515 book-28@661.155 book-29@984.495",
          ],
          "s": 14,
          "width": 1157.333,
          "z": 1.556,
        },
        "phone": {
          "height": 5677.4,
          "phone": true,
          "rows": [
            "top18 P0 w197.381 h251 | book-0@0 book-1@134.6",
            "top285 P2 w219 h310.08 | book-2@0",
            "top611.08 P3 w157.6 h242.56 | book-3@0",
            "top869.64 P0 w237.555 h301.64 | book-4@0 book-5@176.8",
            "top1187.28 P1 w293.302 h293.2 | book-7@0 book-6@163.4",
            "top1496.48 P2 w277.73 h284.76 | book-8@0 book-9@219",
            "top1797.24 P3 w199.8 h276.32 | book-10@0",
            "top2089.56 P0 w219 h208.8 | book-11@0",
            "top2314.36 P2 w191.304 h267.88 | book-12@0 book-13@134.6",
            "top2598.24 P1 w242 h259.44 | book-14@79",
            "top2873.68 P3 w157.6 h191.92 | book-15@0",
            "top3081.6 P2 w231.478 h310.08 | book-16@0 book-17@176.8",
            "top3407.68 P1 w287.226 h301.64 | book-19@0 book-18@163.4",
            "top3725.32 P3 w294.653 h293.2 | book-20@0 book-21@246.347",
            "top4034.52 P0 w176.8 h225.68 | book-22@0",
            "top4276.2 P1 w242 h284.76 | book-23@79",
            "top4576.96 P3 w208.227 h276.32 | book-24@0 book-25@248.373",
            "top4869.28 P0 w219 h208.8 | book-26@0",
            "top5094.08 P2 w297.648 h267.88 | book-27@0 book-28@134.6",
            "top5377.96 P3 w242 h259.44 | book-29@0",
          ],
          "s": 8.44,
          "width": 358,
          "z": 1,
        },
        "tall": {
          "height": 4052.222,
          "phone": false,
          "rows": [
            "top28 P0 w775.309 h510.222 | book-0@113.512 book-1@335.956 book-2@439.436 book-3@666.188",
            "top563.111 P3 w867.027 h496.222 | book-4@67.653 book-6@548.96 book-7@711.24 book-5@395.925",
            "top1084.222 P1 w875.538 h468.222 | book-9@63.398 book-10@160.158 book-11@319.078 book-8@576.491",
            "top1577.333 P2 w732.782 h440.222 | book-13@134.775 book-12@228.175 book-14@450.62 book-15@655.574",
            "top2042.444 P3 w840.271 h510.222 | book-16@81.031 book-18@555.742 book-19@707.942 book-17@409.456",
            "top2577.556 P1 w845.298 h482.222 | book-21@78.518 book-22@165.198 book-23@314.038 book-20@561.371",
            "top3084.667 P2 w974.115 h454.222 | book-25@14.109 book-26@97.429 book-24@242.909 book-27@465.354 book-28@725.298",
            "top3563.778 P3 w398.778 h426.222 | book-29@301.778",
          ],
          "s": 14,
          "width": 1095.667,
          "z": 1.556,
        },
      }
    `)
  })

  it('pins the scale floor Z for a tall book and the phone shrink floor', () => {
    const tall = [book('tall', { h: 60 }), book('x'), book('y')]
    const wide = [book('wide', { w: 200 }), book('x'), book('y')]
    expect({
      tall1000: pinCase(caseLayout(tall, 1440, 1000)),
      tall600: pinCase(caseLayout(tall, 1280, 600)),
      wideDesktop: pinCase(caseLayout(wide, 1440, 900)),
      widePhone: pinCase(caseLayout(wide, 390, 844)),
    }).toMatchInlineSnapshot(`
      {
        "tall1000": {
          "height": 945.185,
          "phone": false,
          "rows": [
            "top26.667 P0 w453.434 h859.259 | tall@307.505 x@586.024 y@707.728",
          ],
          "s": 13.333,
          "width": 1157.333,
          "z": 1.481,
        },
        "tall600": {
          "height": 458,
          "phone": false,
          "rows": [
            "top18 P0 w205.612 h400 | tall@379.194 x@507.194 y@560.861",
          ],
          "s": 6,
          "width": 1024,
          "z": 1,
        },
        "wideDesktop": {
          "height": 939.556,
          "phone": false,
          "rows": [
            "top28 P0 w2812.444 h412.222 | wide@-874.222",
            "top465.111 P1 w386.898 h412.222 | y@338.551 x@433.004",
          ],
          "s": 14,
          "width": 1157.333,
          "z": 1.556,
        },
        "widePhone": {
          "height": 348.297,
          "phone": true,
          "rows": [
            "top18 P0 w785.188 h137.148 | wide@0",
            "top171.148 P1 w133.719 h137.148 | y@0 x@212.281",
          ],
          "s": 3.886,
          "width": 358,
          "z": 1,
        },
      }
    `)
  })

  test.prop([
    books,
    fc.integer({ min: 641, max: 2560 }),
    fc.integer({ min: 600, max: 1440 }),
  ])(
    'desktop: z in Z…14/9, every book once, rows centred in the bay',
    (bs, vw, vh) => {
      const c = caseLayout(bs, vw, vh)
      expect(c.z).toBeGreaterThanOrEqual(1)
      expect(c.z).toBeLessThanOrEqual(14 / 9 + 1e-9)
      expect(c.rows.flatMap((r) => r.items.map((it) => it.b))).toHaveLength(
        bs.length,
      )
      for (let i = 1; i < c.rows.length; i++) {
        const [a, b] = [c.rows[i - 1], c.rows[i]]
        if (a === undefined || b === undefined) throw new Error('row')
        expect(b.top).toBeCloseTo(a.top + a.height + 16 * c.z, 6)
      }
    },
  )
})
