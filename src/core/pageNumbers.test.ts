import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  applyBookOp,
  folioText,
  formatPageNumber,
  pageNumberItems,
  pageNumberPosition,
  resolveSpread,
  setParentPageNumbers,
  spreadFolios,
  syncPageNumbers,
  type Book,
  type PageNumberItem,
  type PageNumberPosition,
  type ParentSpread,
  type Spread,
} from './index'
import { makeBook, makeSpread } from './testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Math.max(1000, Number(process.env.FC_NUM_RUNS ?? 1000)),
}

const POSITIONS: readonly PageNumberPosition[] = ['outer', 'centre', 'inner']

const A5 = { trim: { widthMm: 148, heightMm: 210 }, safeMarginMm: 5 }

function master(extra: Partial<ParentSpread> = {}): ParentSpread {
  return { id: 'pA', name: 'Master A', frames: [], guides: [], ...extra }
}

function spreads(count: number, extra: Partial<Spread> = {}): Spread[] {
  return Array.from({ length: count }, (_, i) =>
    makeSpread({ id: `s${String(i)}`, frames: [], ...extra }),
  )
}

/** A5, 15 mm margins, `count` spreads on Master A showing folios at `position`. */
function numberedBook(
  count = 4,
  position: PageNumberPosition = 'outer',
  extra: Partial<Book> = {},
): Book {
  const book = makeBook({
    settings: A5,
    parents: [master()],
    defaultParentId: 'pA',
    spreads: spreads(count),
    ...extra,
  })
  return setParentPageNumbers(book, 'pA', position)
}

function itemsOf(book: Book, parentId = 'pA'): PageNumberItem[] {
  return book.parents?.find((p) => p.id === parentId)?.pageNumbers ?? []
}

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
}

function parseRoman(text: string): number {
  let total = 0
  for (let i = 0; i < text.length; i += 1) {
    const value = ROMAN_VALUES[text.charAt(i)] ?? Number.NaN
    const next = ROMAN_VALUES[text.charAt(i + 1)] ?? 0
    total += value < next ? -value : value
  }
  return total
}

describe('formatPageNumber', () => {
  it('formats decimal and roman numbers; roman has no zero', () => {
    expect(formatPageNumber(7, 'decimal')).toBe('7')
    expect(formatPageNumber(0, 'decimal')).toBe('0')
    expect(formatPageNumber(14, 'lower-roman')).toBe('xiv')
    expect(formatPageNumber(1999, 'upper-roman')).toBe('MCMXCIX')
    expect(formatPageNumber(444, 'upper-roman')).toBe('CDXLIV')
    expect(formatPageNumber(0, 'upper-roman')).toBeUndefined()
    expect(formatPageNumber(0, 'lower-roman')).toBeUndefined()
  })

  it('roman round-trips 1–999 in canonical form (PBT)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (n) => {
        const upper = formatPageNumber(n, 'upper-roman') ?? ''
        expect(parseRoman(upper)).toBe(n)
        expect(upper).toMatch(
          /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/,
        )
        expect(formatPageNumber(n, 'lower-roman')).toBe(upper.toLowerCase())
      }),
      runs,
    )
  })
})

describe('pageNumberItems: A5, margins 15, safe 5', () => {
  const book = makeBook({ settings: A5, parents: [master()] })

  function rects(position: PageNumberPosition) {
    const [left, right] = pageNumberItems(book, 'pA', position)
    return { left, right }
  }

  it('sits centred in the bottom margin band: y 200.33, 20 × 4.34 mm', () => {
    for (const position of POSITIONS) {
      for (const item of pageNumberItems(book, 'pA', position)) {
        expect(item.rect.y).toBeCloseTo(200.33, 2)
        expect(item.rect.width).toBe(20)
        expect(item.rect.height).toBe(4.34)
        // Box bottom 5.33 mm above the trim.
        expect(210 - item.rect.y - item.rect.height).toBeCloseTo(5.33, 2)
      }
    }
  })

  it('Outer: 15 mm from both outer edges', () => {
    const { left, right } = rects('outer')
    expect(left).toEqual(
      expect.objectContaining({ id: 'pA-pn-l', align: 'left' }),
    )
    expect(left?.rect.x).toBe(15)
    expect(right).toEqual(
      expect.objectContaining({ id: 'pA-pn-r', align: 'right' }),
    )
    expect(296 - ((right?.rect.x ?? 0) + 20)).toBe(15)
  })

  it('Centre: boxes centred on each page', () => {
    const { left, right } = rects('centre')
    expect(left?.rect.x).toBe(64)
    expect(right?.rect.x).toBe(212)
    expect([left?.align, right?.align]).toEqual(['center', 'center'])
  })

  it('Inner: 15 mm from the spine on both pages', () => {
    const { left, right } = rects('inner')
    expect(148 - ((left?.rect.x ?? 0) + 20)).toBe(15)
    expect(left?.align).toBe('right')
    expect((right?.rect.x ?? 0) - 148).toBe(15)
    expect(right?.align).toBe('left')
  })

  it('reads the parent grid over the book grid', () => {
    const own = makeBook({
      settings: A5,
      parents: [
        master({ layoutGrid: { margins: { bottom: 30, outside: 22 } } }),
      ],
    })
    const [left] = pageNumberItems(own, 'pA', 'outer')
    expect(left?.rect.x).toBe(22)
    expect(left?.rect.y).toBeCloseTo(192.83, 2)
  })

  it('clamps into the safe area when margins are below it', () => {
    const tight = makeBook({
      settings: A5,
      layoutGrid: { margins: { top: 0, bottom: 0, inside: 0, outside: 0 } },
      parents: [master()],
    })
    const [left, right] = pageNumberItems(tight, 'pA', 'outer')
    expect(left?.rect.x).toBe(5)
    expect((right?.rect.x ?? 0) + 20).toBe(291)
    expect(left?.rect.y).toBeCloseTo(200.66, 2)
    const [innerLeft, innerRight] = pageNumberItems(tight, 'pA', 'inner')
    expect((innerLeft?.rect.x ?? 0) + 20).toBe(143)
    expect(innerRight?.rect.x).toBe(153)
  })

  it('an unknown parent has no items', () => {
    expect(pageNumberItems(book, 'nope', 'outer')).toEqual([])
  })

  it('keeps every rect inside its page safe area for margins 0–40 (PBT)', () => {
    const mm = fc.integer({ min: 0, max: 40 })
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 0, max: 10 }),
        fc.record({ top: mm, bottom: mm, inside: mm, outside: mm }),
        fc.constantFrom(...POSITIONS),
        (widthMm, heightMm, safe, margins, position) => {
          const sized = makeBook({
            settings: { trim: { widthMm, heightMm }, safeMarginMm: safe },
            layoutGrid: { margins },
            parents: [master()],
          })
          const items = pageNumberItems(sized, 'pA', position)
          expect(items).toHaveLength(2)
          items.forEach(({ rect }, page) => {
            const pageX = rect.x - page * widthMm
            expect(pageX).toBeGreaterThanOrEqual(safe - 1e-9)
            expect(pageX + rect.width).toBeLessThanOrEqual(
              widthMm - safe + 1e-9,
            )
            expect(rect.y).toBeGreaterThanOrEqual(safe)
            expect(rect.y + rect.height).toBeLessThanOrEqual(
              heightMm - safe + 1e-9,
            )
          })
        },
      ),
      runs,
    )
  })
})

describe('pageNumberPosition', () => {
  it('reads the position back from the left item align', () => {
    for (const position of POSITIONS) {
      const parent = numberedBook(4, position).parents?.[0]
      expect(parent && pageNumberPosition(parent)).toBe(position)
    }
  })

  it('is null without a left item', () => {
    expect(pageNumberPosition(master())).toBeNull()
    const [, right] = pageNumberItems(numberedBook(), 'pA', 'inner')
    expect(
      pageNumberPosition(master({ pageNumbers: right ? [right] : [] })),
    ).toBeNull()
  })

  it('an item without align reads as Outer', () => {
    const [left] = itemsOf(numberedBook())
    const bare = left === undefined ? [] : [{ id: left.id, rect: left.rect }]
    expect(pageNumberPosition(master({ pageNumbers: bare }))).toBe('outer')
  })
})

describe('folioText', () => {
  // 4 spreads: pages 1 | 2–3 | 4–5 | 6.
  it('numbers physical pages; missing pages have none', () => {
    const book = numberedBook()
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => folioText(book, p))).toEqual([
      undefined,
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      undefined,
    ])
    expect(folioText(book, 2.5)).toBeUndefined()
  })

  it('applies start and format; skipFirst blanks page 1 only', () => {
    const book = numberedBook(4, 'outer', {
      pageNumbering: { start: 10, skipFirst: true, format: 'lower-roman' },
    })
    expect(folioText(book, 1)).toBeUndefined()
    expect(folioText(book, 2)).toBe('xi')
    expect(folioText(book, 6)).toBe('xv')
  })

  it('roman start 0 has no folio on page 1; decimal prints 0', () => {
    const roman = numberedBook(3, 'outer', {
      pageNumbering: { start: 0, skipFirst: false, format: 'upper-roman' },
    })
    expect(folioText(roman, 1)).toBeUndefined()
    expect(folioText(roman, 2)).toBe('I')
    const decimal = numberedBook(3, 'outer', {
      pageNumbering: { start: 0, skipFirst: false, format: 'decimal' },
    })
    expect(folioText(decimal, 1)).toBe('0')
  })

  it('a hidden item, None parent or a parent without items prints nothing', () => {
    const book = numberedBook()
    const hidden = {
      ...book,
      spreads: book.spreads.map((spread, i) =>
        i === 1
          ? { ...spread, parentOverrides: { hiddenIds: ['pA-pn-l'] } }
          : i === 2
            ? { ...spread, parentId: null }
            : spread,
      ),
    }
    expect(folioText(hidden, 2)).toBeUndefined()
    expect(folioText(hidden, 3)).toBe('3')
    expect(folioText(hidden, 4)).toBeUndefined()
    expect(folioText(hidden, 5)).toBeUndefined()
    expect(folioText(setParentPageNumbers(book, 'pA', null), 3)).toBeUndefined()
  })

  it('a one-spread book has page 1 only', () => {
    const book = numberedBook(1)
    expect(folioText(book, 1)).toBe('1')
    expect(folioText(book, 2)).toBeUndefined()
  })

  it('counts pages − skipped folios and renumbers on reorder (PBT)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.boolean(),
        fc.integer({ min: 1, max: 999 }),
        fc.nat(),
        fc.nat(),
        (count, skipFirst, start, from, to) => {
          const before = numberedBook(count, 'outer', {
            pageNumbering: { start, skipFirst, format: 'decimal' },
          })
          const pages = count === 1 ? 1 : 2 * count - 2
          const texts = (book: Book) =>
            Array.from({ length: pages + 1 }, (_, i) => folioText(book, i + 1))
          const printed = texts(before).filter((t) => t !== undefined)
          expect(printed).toHaveLength(pages - (skipFirst ? 1 : 0))
          const perSpread = before.spreads.flatMap((_, i) =>
            spreadFolios(before, i),
          )
          expect(perSpread).toHaveLength(printed.length)

          const moved = applyBookOp(before, {
            type: 'moveSpread',
            spreadId: `s${String(from % count)}`,
            toIndex: to % count,
          })
          // Derived, never stored: items stay, numbers follow the new page.
          expect(moved.parents).toBe(before.parents)
          expect(texts(moved)).toEqual(texts(before))
          moved.spreads.forEach((_, i) => {
            for (const folio of spreadFolios(moved, i)) {
              const page = 2 * i + (folio.id.endsWith('-pn-r') ? 1 : 0)
              expect(folio.text).toBe(String(start + page - 1))
            }
          })
        },
      ),
      runs,
    )
  })
})

describe('spreadFolios', () => {
  const book = numberedBook()

  it('page 1 alone on the right, in single-page mm', () => {
    expect(spreadFolios(book, 0)).toEqual([
      {
        id: 'pA-pn-r',
        text: '1',
        rectMm: expect.objectContaining({ x: 148 - 15 - 20 }) as unknown,
        align: 'right',
      },
    ])
  })

  it('both pages on a middle spread; the single last page on the left', () => {
    expect(
      spreadFolios(book, 1).map((f) => [f.id, f.text, f.rectMm.x]),
    ).toEqual([
      ['pA-pn-l', '2', 15],
      ['pA-pn-r', '3', 261],
    ])
    expect(spreadFolios(book, 3).map((f) => [f.text, f.rectMm.x])).toEqual([
      ['6', 15],
    ])
    expect(spreadFolios(book, 4)).toEqual([])
  })

  it('an item without align resolves left', () => {
    const [left, right] = itemsOf(book)
    const bare =
      left === undefined || right === undefined
        ? []
        : [{ id: left.id, rect: left.rect }, right]
    const parents = [master({ pageNumbers: bare })]
    expect(spreadFolios({ ...book, parents }, 1)[0]?.align).toBe('left')
  })
})

describe('page number ops', () => {
  it('setParentPageNumbers writes, keeps and removes the items', () => {
    const book = numberedBook()
    expect(itemsOf(book).map((item) => item.id)).toEqual(['pA-pn-l', 'pA-pn-r'])
    const op = { type: 'setParentPageNumbers', parentId: 'pA' } as const
    expect(applyBookOp(book, { ...op, position: 'outer' })).toBe(book)
    const inner = applyBookOp(book, { ...op, position: 'inner' })
    expect(itemsOf(inner)[0]?.align).toBe('right')
    const off = applyBookOp(book, { ...op, position: null })
    expect(off.parents?.[0] && 'pageNumbers' in off.parents[0]).toBe(false)
    expect(applyBookOp(off, { ...op, position: null })).toBe(off)
    expect(
      applyBookOp(book, { ...op, parentId: 'nope', position: 'inner' }),
    ).toBe(book)
  })

  it('setPageNumbering merges, rounds and clamps start to 1–999', () => {
    const book = numberedBook()
    const set = (
      patch: Parameters<typeof applyBookOp>[1] & { type: 'setPageNumbering' },
    ) => applyBookOp(book, patch).pageNumbering
    expect(
      set({ type: 'setPageNumbering', patch: { start: 0 } }),
    ).toBeUndefined()
    expect(
      set({ type: 'setPageNumbering', patch: { start: 3.6 } })?.start,
    ).toBe(4)
    expect(
      set({ type: 'setPageNumbering', patch: { start: 5000 } })?.start,
    ).toBe(999)
    expect(
      set({ type: 'setPageNumbering', patch: { start: -4 } }),
    ).toBeUndefined()
    expect(
      applyBookOp(book, {
        type: 'setPageNumbering',
        patch: { start: Number.NaN },
      }),
    ).toBe(book)
    const roman = applyBookOp(book, {
      type: 'setPageNumbering',
      patch: { format: 'upper-roman', skipFirst: true },
    })
    expect(roman.pageNumbering).toEqual({
      start: 1,
      skipFirst: true,
      format: 'upper-roman',
    })
    expect(
      applyBookOp(roman, { type: 'setPageNumbering', patch: { start: 7 } })
        .pageNumbering,
    ).toEqual({ start: 7, skipFirst: true, format: 'upper-roman' })
  })

  it('a trim change re-derives the rects', () => {
    const book = applyBookOp(numberedBook(), {
      type: 'setTrim',
      widthMm: 200,
      heightMm: 210,
    })
    const [left, right] = itemsOf(book)
    expect(left?.rect.x).toBe(15)
    expect(right?.rect.x).toBe(400 - 15 - 20)
  })

  it('grid edits on the master or the book re-derive; a spread edit keeps them', () => {
    const book = numberedBook()
    const master = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'pA',
      patch: { outside: 25 },
    })
    expect(itemsOf(master)[0]?.rect.x).toBe(25)
    const reset = applyBookOp(master, {
      type: 'resetSpreadGrid',
      spreadId: 'pA',
    })
    expect(itemsOf(reset)).toEqual(itemsOf(book))
    const field = applyBookOp(master, {
      type: 'resetSpreadGridFields',
      spreadId: 'pA',
      fields: ['outside'],
    })
    expect(itemsOf(field)[0]?.rect.x).toBe(15)
    const bottom = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { bottom: 30 },
    })
    expect(itemsOf(bottom)[0]?.rect.y).toBeCloseTo(192.83, 2)
    const own = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 's1',
      patch: { outside: 25 },
    })
    expect(own.parents).toBe(book.parents)
  })

  it('syncPageNumbers keeps an in-sync book and skips parents without items', () => {
    const book = numberedBook(4, 'centre', {
      parents: [master(), master({ id: 'pB', name: 'Master B' })],
    })
    expect(syncPageNumbers(book)).toBe(book)
    const plain = makeBook()
    expect(syncPageNumbers(plain)).toBe(plain)
  })
})

describe('resolveSpread folios', () => {
  it('resolves the folios of the spread; none on the master view', () => {
    const book = numberedBook()
    expect(resolveSpread(book, 's1')?.folios?.map((f) => f.text)).toEqual([
      '2',
      '3',
    ])
    expect(resolveSpread(book, 'pA')?.folios).toBeUndefined()
    const off = setParentPageNumbers(book, 'pA', null)
    expect(resolveSpread(off, 's1')).not.toHaveProperty('folios')
  })

  it('reuses folios until numbering, items or the index change', () => {
    const book = numberedBook()
    const first = resolveSpread(book, 's1')?.folios
    expect(resolveSpread(book, 's1')?.folios).toBe(first)
    const roman = applyBookOp(book, {
      type: 'setPageNumbering',
      patch: { format: 'upper-roman' },
    })
    expect(resolveSpread(roman, 's1')?.folios?.map((f) => f.text)).toEqual([
      'II',
      'III',
    ])
    const inner = setParentPageNumbers(roman, 'pA', 'inner')
    expect(resolveSpread(inner, 's1')?.folios?.[0]?.align).toBe('right')
    const moved = applyBookOp(inner, {
      type: 'moveSpread',
      spreadId: 's1',
      toIndex: 2,
    })
    expect(resolveSpread(moved, 's1')?.folios?.map((f) => f.text)).toEqual([
      'IV',
      'V',
    ])
    expect(resolveSpread(moved, 's0')?.folios?.map((f) => f.text)).toEqual([
      'I',
    ])
  })
})

describe('page numbers: edge cases', () => {
  it('a book without parents has no items', () => {
    const plain = makeBook({ settings: A5 })
    expect(pageNumberItems(plain, 'pA', 'outer')).toEqual([])
  })

  it('centres the box when the page is too narrow for the safe area', () => {
    const tiny = makeBook({
      settings: { trim: { widthMm: 50, heightMm: 50 }, safeMarginMm: 20 },
      parents: [master()],
    })
    for (const position of POSITIONS) {
      const xs = pageNumberItems(tiny, 'pA', position).map((i) => i.rect.x)
      expect(xs).toEqual([15, 65])
    }
  })

  it('overrides without hiddenIds keep the folio', () => {
    const book = numberedBook()
    const copied = {
      ...book,
      spreads: book.spreads.map((spread) => ({
        ...spread,
        parentOverrides: { frames: [] },
      })),
    }
    expect(folioText(copied, 2)).toBe('2')
  })

  it('a roman zero leaves page 1 without a folio on the spread', () => {
    const book = numberedBook(3, 'outer', {
      pageNumbering: { start: 0, skipFirst: false, format: 'lower-roman' },
    })
    expect(spreadFolios(book, 0)).toEqual([])
    expect(spreadFolios(book, 1).map((f) => f.text)).toEqual(['i', 'ii'])
  })

  it('sync rewrites any stale field of a stored item', () => {
    const book = numberedBook()
    const derived = itemsOf(book)
    const [left, right] = derived as [PageNumberItem, PageNumberItem]
    const stale: PageNumberItem[] = [
      { ...right, id: 'pA-pn-x' },
      { ...right, align: 'center' },
      { ...right, rect: { ...right.rect, x: 1 } },
      { ...right, rect: { ...right.rect, y: 1 } },
      { ...right, rect: { ...right.rect, width: 1 } },
      { ...right, rect: { ...right.rect, height: 1 } },
    ]
    for (const item of stale) {
      const parents = [master({ pageNumbers: [left, item] })]
      const synced = syncPageNumbers({ ...book, parents })
      expect(itemsOf(synced)).toEqual(derived)
    }
  })

  it('setPageNumbering changes skipFirst alone; an empty patch is a no-op', () => {
    const book = numberedBook()
    expect(
      applyBookOp(book, {
        type: 'setPageNumbering',
        patch: { skipFirst: true },
      }).pageNumbering,
    ).toEqual({ start: 1, skipFirst: true, format: 'decimal' })
    expect(applyBookOp(book, { type: 'setPageNumbering', patch: {} })).toBe(
      book,
    )
    expect(
      applyBookOp(book, {
        type: 'setPageNumbering',
        patch: { format: 'decimal', skipFirst: false },
      }),
    ).toBe(book)
  })
})
