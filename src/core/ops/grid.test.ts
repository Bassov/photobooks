import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  GRID_FIELDS,
  clampGridValue,
  effectiveGrid,
  hasGridOverride,
  type GridPatch,
} from '../grid/layoutGrid'
import { parseBook, serializeBook } from '../parse'
import type { Book, ParentSpread, Spread } from '../schema'
import { applyTemplate } from '../templates/apply'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { makePainterFixture } from '../testing/painterFixture'
import { applyBookOp, type BookOp } from './applyBookOp'

type GridOverride = NonNullable<Spread['layoutGrid']>

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const templated = (id: string) =>
  makeSpread({ id, templateId: '2-up', frames: [makeFrame({ id: `${id}-f` })] })

/** Two spreads already aligned to the 2-up template, one free-layout spread. */
function bookWithTemplates() {
  const raw = makeBook({
    spreads: [templated('a'), templated('b'), makeSpread({ id: 'free' })],
  })
  return ['a', 'b'].reduce((acc, id) => applyTemplate(acc, id, '2-up'), raw)
}

describe('clampGridValue', () => {
  it.each([
    ['columns', 0, 1],
    ['columns', 99, 12],
    ['rows', 3.6, 4],
    ['top', -5, 0],
    ['columnGutterMm', 2.5, 2.5],
    ['rowGutterMm', Number.NaN, 0],
    ['columns', Number.NaN, 1],
  ] as const)('%s %s → %s', (field, input, expected) => {
    expect(clampGridValue(field, input)).toBe(expected)
  })
})

describe('setBookGrid', () => {
  it('clamps columns to 1–12 and margins to ≥ 0', () => {
    const next = applyBookOp(makeBook(), {
      type: 'setBookGrid',
      patch: { columns: 40, top: -3 },
    })
    expect(next.layoutGrid.columns).toBe(12)
    expect(next.layoutGrid.margins.top).toBe(0)
  })

  it('returns the same book for a no-op patch', () => {
    const book = makeBook()
    expect(
      applyBookOp(book, { type: 'setBookGrid', patch: { columns: 2 } }),
    ).toBe(book)
  })

  it('re-aligns templated spreads and keeps placements', () => {
    const book = makeBook({
      assets: { p: {} },
      gallery: ['p'],
      spreads: [
        makeSpread({
          id: 'a',
          templateId: '2-up',
          frames: [makeFrame({ id: 'a-f0', assetId: 'p' })],
        }),
      ],
    })
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { columnGutterMm: 30 },
    })
    const before = book.spreads[0]?.frames[0]
    const after = next.spreads[0]?.frames[0]
    expect(after?.assetId).toBe('p')
    expect(after?.rect).not.toEqual(before?.rect)
  })

  it('keeps every spread on a columns / rows edit: templates read margins and gutters', () => {
    const book = bookWithTemplates()
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { columns: 6, rows: 3 },
    })
    expect(next.layoutGrid.columns).toBe(6)
    expect(next.spreads).toBe(book.spreads)
  })

  it('keeps the frame objects a re-align does not move', () => {
    const raw = makeBook({
      spreads: [makeSpread({ id: 'h', templateId: 'hero-two', frames: [] })],
    })
    const book = applyTemplate(raw, 'h', 'hero-two')
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { rowGutterMm: 20 },
    })
    const [hero, top] = book.spreads[0]?.frames ?? []
    expect(next.spreads[0]?.frames[0]).toBe(hero)
    expect(next.spreads[0]?.frames[1]).not.toBe(top)
    expect(next.spreads[0]?.frames[1]?.id).toBe(top?.id)
  })

  it('leaves free-layout spreads untouched', () => {
    const book = bookWithTemplates()
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { top: 40 },
    })
    expect(next.spreads[2]).toBe(book.spreads[2])
  })

  it('does not re-resolve a spread that overrides the changed field', () => {
    let book = bookWithTemplates()
    book = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { top: 20 },
    })
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { top: 40 },
    })
    expect(next.spreads[0]).toBe(book.spreads[0])
    expect(next.spreads[1]).not.toBe(book.spreads[1])
  })
})

describe('spread overrides', () => {
  it('stores only the changed field and labels its source SPREAD', () => {
    const next = applyBookOp(bookWithTemplates(), {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { columns: 5, inside: 22 },
    })
    const spread = next.spreads[0]
    expect(spread?.layoutGrid).toEqual({ columns: 5, margins: { inside: 22 } })
    const { values, source } = effectiveGrid(next, spread)
    expect(values.columns).toBe(5)
    expect(values.inside).toBe(22)
    expect(values.outside).toBe(next.layoutGrid.margins.outside)
    expect(source.columns).toBe('spread')
    expect(source.inside).toBe('spread')
    expect(source.rows).toBe('book')
    expect(source.outside).toBe('book')
  })

  it('an empty or repeated patch is a no-op', () => {
    const book = applyBookOp(bookWithTemplates(), {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { columns: 5 },
    })
    const empty = { type: 'setSpreadGrid', spreadId: 'a', patch: {} } as const
    expect(applyBookOp(book, empty)).toBe(book)
    const same = { ...empty, patch: { columns: 5 } } as const
    expect(applyBookOp(book, same)).toBe(book)
  })

  it('does not touch other spreads', () => {
    const book = bookWithTemplates()
    const next = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { columns: 5 },
    })
    expect(next.spreads[1]).toBe(book.spreads[1])
    expect(effectiveGrid(next, next.spreads[1]).values.columns).toBe(2)
  })

  it('reset drops every override; clean spreads stay identical', () => {
    const overridden = applyBookOp(bookWithTemplates(), {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { rows: 4, top: 1 },
    })
    expect(hasGridOverride(overridden.spreads[0] ?? makeSpread())).toBe(true)
    const reset = applyBookOp(overridden, {
      type: 'resetSpreadGrid',
      spreadId: 'a',
    })
    expect(reset.spreads[0]?.layoutGrid).toBeUndefined()
    expect(hasGridOverride(reset.spreads[0] ?? makeSpread())).toBe(false)
    const again = applyBookOp(reset, { type: 'resetSpreadGrid', spreadId: 'a' })
    expect(again).toBe(reset)
  })

  it('a partial override survives serialize → parse', () => {
    const book = applyBookOp(bookWithTemplates(), {
      type: 'setSpreadGrid',
      spreadId: 'b',
      patch: { outside: 9 },
    })
    const parsed = parseBook(serializeBook(book))
    expect(parsed).toMatchObject({
      ok: true,
      book: { spreads: [{}, { layoutGrid: { margins: { outside: 9 } } }, {}] },
    })
  })
})

describe('re-align on grid edits', () => {
  it('re-aligns a spread that overrides one changed field but not another', () => {
    let book = bookWithTemplates()
    book = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { top: 20 },
    })
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { top: 40, columnGutterMm: 30 },
    })
    expect(next.spreads[0]?.frames[0]?.rect).not.toEqual(
      book.spreads[0]?.frames[0]?.rect,
    )
  })

  it('an override re-aligns its own templated spread', () => {
    const book = bookWithTemplates()
    const next = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { columnGutterMm: 40 },
    })
    expect(next.spreads[0]?.frames[0]?.rect).not.toEqual(
      book.spreads[0]?.frames[0]?.rect,
    )
    expect(next.spreads[1]?.frames).toBe(book.spreads[1]?.frames)
  })

  it('reset re-aligns the spread back to the book grid', () => {
    const book = bookWithTemplates()
    const overridden = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'a',
      patch: { columnGutterMm: 40 },
    })
    const reset = applyBookOp(overridden, {
      type: 'resetSpreadGrid',
      spreadId: 'a',
    })
    expect(reset.spreads[0]?.frames[0]?.rect).toEqual(
      book.spreads[0]?.frames[0]?.rect,
    )
  })

  it('does not regenerate free or unknown-template spreads', () => {
    const legacy = makeSpread({ id: 'legacy', templateId: 't-two-up' })
    const book = makeBook({ spreads: [legacy, makeSpread({ id: 'free' })] })
    const a = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'legacy',
      patch: { columnGutterMm: 40 },
    })
    expect(a.spreads[0]?.frames).toBe(legacy.frames)
    const b = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'free',
      patch: { columnGutterMm: 40 },
    })
    expect(b.spreads[1]?.frames).toBe(book.spreads[1]?.frames)
  })
})

const masterOf = (id: string, layoutGrid?: GridOverride): ParentSpread => ({
  id,
  name: `Master ${id}`,
  frames: [],
  guides: [],
  ...(layoutGrid === undefined ? {} : { layoutGrid }),
})

/**
 * 2-up spreads on the default Master A (`a`, `b`, and `c` overriding the
 * column gutter), `d` on Master B, `e` on None, plus a free spread. `a`
 * holds a placed photo.
 */
function bookWithMasters(masterGrid?: GridOverride): Book {
  const raw = makeBook({
    assets: { p: {} },
    gallery: ['p'],
    defaultParentId: 'ma',
    parents: [masterOf('ma', masterGrid), masterOf('mb')],
    spreads: [
      makeSpread({
        id: 'a',
        templateId: '2-up',
        frames: [makeFrame({ id: 'a-f', assetId: 'p' })],
      }),
      templated('b'),
      { ...templated('c'), layoutGrid: { columnGutterMm: 12 } },
      { ...templated('d'), parentId: 'mb' },
      { ...templated('e'), parentId: null },
      makeSpread({ id: 'free' }),
    ],
  })
  return ['a', 'b', 'c', 'd', 'e'].reduce(
    (acc, id) => applyTemplate(acc, id, '2-up'),
    raw,
  )
}

/** Templated spreads with frames knocked off the grid, so any re-align shows. */
const offGrid = (book: Book): Book => ({
  ...book,
  spreads: book.spreads.map((spread) =>
    spread.templateId === undefined
      ? spread
      : {
          ...spread,
          frames: spread.frames.map((frame) => ({
            ...frame,
            rect: { x: 1, y: 1, width: 10, height: 10 },
          })),
        },
  ),
})

const spreadOf = (book: Book, id: string) =>
  book.spreads.find((spread) => spread.id === id)

/** True when the templated spread's frames already match its effective grid. */
const isAligned = (book: Book, id: string) =>
  applyTemplate(book, id, '2-up') === book

/** Ids of the spreads whose object changed between two books. */
const changedIds = (before: Book, after: Book) =>
  after.spreads
    .filter((spread, index) => spread !== before.spreads[index])
    .map((spread) => spread.id)

describe('master grid edits re-align its spreads', () => {
  it('moves the frames of the spreads using the master, keeping placements', () => {
    const op: BookOp = {
      type: 'setSpreadGrid',
      spreadId: 'ma',
      patch: { columnGutterMm: 30 },
    }
    const book = bookWithMasters()
    const next = applyBookOp(book, op)
    expect(next.parents?.[0]?.layoutGrid).toEqual({ columnGutterMm: 30 })
    expect(changedIds(book, next)).toEqual(['a', 'b'])
    expect(spreadOf(next, 'a')?.frames[0]?.rect).not.toEqual(
      spreadOf(book, 'a')?.frames[0]?.rect,
    )
    expect(spreadOf(next, 'a')?.frames[0]?.assetId).toBe('p')
    expect(isAligned(next, 'a') && isAligned(next, 'b')).toBe(true)
    // Off-grid frames would move on any re-align: only the users re-align.
    const stale = offGrid(book)
    expect(changedIds(stale, applyBookOp(stale, op))).toEqual(['a', 'b'])
  })

  it('re-aligns a spread overriding only some of the changed fields', () => {
    const book = offGrid(bookWithMasters())
    const next = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'ma',
      patch: { top: 30, columnGutterMm: 30 },
    })
    expect(changedIds(book, next)).toEqual(['a', 'b', 'c'])
    expect(isAligned(next, 'c')).toBe(true)
  })

  it('a repeated master patch is a no-op', () => {
    const book = applyBookOp(bookWithMasters(), {
      type: 'setSpreadGrid',
      spreadId: 'ma',
      patch: { columnGutterMm: 30 },
    })
    expect(
      applyBookOp(book, {
        type: 'setSpreadGrid',
        spreadId: 'ma',
        patch: { columnGutterMm: 30 },
      }),
    ).toBe(book)
  })

  it('resetting the master grid re-aligns its spreads back to the book grid', () => {
    const book = bookWithMasters()
    const edited = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'ma',
      patch: { columnGutterMm: 30, top: 30 },
    })
    const reset = applyBookOp(edited, {
      type: 'resetSpreadGrid',
      spreadId: 'ma',
    })
    expect(reset.parents?.[0]).not.toHaveProperty('layoutGrid')
    for (const id of ['a', 'b', 'c']) {
      expect(spreadOf(reset, id)?.frames).toEqual(spreadOf(book, id)?.frames)
    }
  })

  it('re-aligns all 40 painter spreads when Master A is their default', () => {
    const { book: painter } = makePainterFixture()
    const book: Book = { ...painter, defaultParentId: 'painter-parent-a' }
    const next = applyBookOp(book, {
      type: 'setSpreadGrid',
      spreadId: 'painter-parent-a',
      patch: { columnGutterMm: 20 },
    })
    expect(changedIds(book, next)).toHaveLength(40)
  })
})

describe('setBookGrid re-aligns only book-sourced spreads', () => {
  it('skips spreads that read the field from their master or override it', () => {
    const book = offGrid(bookWithMasters({ columnGutterMm: 20 }))
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { columnGutterMm: 30 },
    })
    expect(changedIds(book, next)).toEqual(['d', 'e'])
    expect(isAligned(next, 'd') && isAligned(next, 'e')).toBe(true)
  })

  it('re-aligns a spread when any one changed field comes from the book', () => {
    const book = offGrid(bookWithMasters({ margins: { top: 10 } }))
    const next = applyBookOp(book, {
      type: 'setBookGrid',
      patch: { columnGutterMm: 30, top: 25 },
    })
    // `c` overrides the gutter and reads top from Master A.
    expect(changedIds(book, next)).toEqual(['a', 'b', 'd', 'e'])
  })
})

describe('resetSpreadGridFields', () => {
  it('clears one field and re-aligns the spread to its master', () => {
    const book = offGrid(bookWithMasters())
    const next = applyBookOp(book, {
      type: 'resetSpreadGridFields',
      spreadId: 'c',
      fields: ['columnGutterMm'],
    })
    expect(spreadOf(next, 'c')).not.toHaveProperty('layoutGrid')
    expect(changedIds(book, next)).toEqual(['c'])
    expect(isAligned(next, 'c')).toBe(true)
  })

  it('clears all four margins and keeps the other overrides', () => {
    const book = applyBookOp(bookWithMasters(), {
      type: 'setSpreadGrid',
      spreadId: 'c',
      patch: { top: 30, bottom: 30, inside: 30, outside: 30 },
    })
    const next = applyBookOp(book, {
      type: 'resetSpreadGridFields',
      spreadId: 'c',
      fields: ['top', 'bottom', 'inside', 'outside'],
    })
    expect(spreadOf(next, 'c')?.layoutGrid).toEqual({ columnGutterMm: 12 })
    expect(spreadOf(next, 'c')?.frames[0]?.rect).not.toEqual(
      spreadOf(book, 'c')?.frames[0]?.rect,
    )
    expect(isAligned(next, 'c')).toBe(true)
  })

  it('keeps the other margins when resetting one', () => {
    const book = applyBookOp(bookWithMasters(), {
      type: 'setSpreadGrid',
      spreadId: 'b',
      patch: { top: 30, bottom: 30 },
    })
    const next = applyBookOp(book, {
      type: 'resetSpreadGridFields',
      spreadId: 'b',
      fields: ['top'],
    })
    expect(spreadOf(next, 'b')?.layoutGrid).toEqual({ margins: { bottom: 30 } })
  })

  it('is a no-op for fields the spread does not override or an unknown spread', () => {
    const book = offGrid(bookWithMasters())
    expect(
      applyBookOp(book, {
        type: 'resetSpreadGridFields',
        spreadId: 'c',
        fields: ['rows', 'top'],
      }),
    ).toBe(book)
    expect(
      applyBookOp(book, {
        type: 'resetSpreadGridFields',
        spreadId: 'ghost',
        fields: ['columnGutterMm'],
      }),
    ).toBe(book)
    const noParents = makeBook()
    expect(
      applyBookOp(noParents, {
        type: 'setSpreadGrid',
        spreadId: 'ghost',
        patch: { columns: 4 },
      }),
    ).toBe(noParents)
  })
})

describe('grid ops keep every templated spread aligned', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'] as const
  const arbPatch: fc.Arbitrary<GridPatch> = fc.record(
    {
      columns: fc.integer({ min: 1, max: 12 }),
      columnGutterMm: fc.integer({ min: 0, max: 20 }),
      top: fc.integer({ min: 0, max: 30 }),
      inside: fc.integer({ min: 0, max: 30 }),
    },
    { requiredKeys: [] },
  )
  const arbOp: fc.Arbitrary<BookOp> = fc.oneof(
    arbPatch.map((patch) => ({ type: 'setBookGrid' as const, patch })),
    fc.record({
      type: fc.constant('setSpreadGrid' as const),
      spreadId: fc.constantFrom('ma', 'mb', ...ids),
      patch: arbPatch,
    }),
    fc.record({
      type: fc.constant('resetSpreadGrid' as const),
      spreadId: fc.constantFrom('ma', 'mb', ...ids),
    }),
    fc.record({
      type: fc.constant('resetSpreadGridFields' as const),
      spreadId: fc.constantFrom('ma', 'mb', ...ids),
      fields: fc.subarray([...GRID_FIELDS]),
    }),
    fc.record({
      type: fc.constant('setSpreadParent' as const),
      spreadId: fc.constantFrom(...ids),
      parentId: fc.constantFrom('ma', 'mb', null),
    }),
  )

  it('after any op sequence every templated spread matches its effective grid', () => {
    fc.assert(
      fc.property(fc.array(arbOp, { maxLength: 6 }), (ops) => {
        const book = ops.reduce(
          (acc, op) => applyBookOp(acc, op),
          bookWithMasters(),
        )
        for (const id of ids) {
          expect(isAligned(book, id)).toBe(true)
        }
        expect(spreadOf(book, 'a')?.frames[0]?.assetId).toBe('p')
      }),
      runs,
    )
  })
})

describe('effectiveGrid', () => {
  it('reports every field as BOOK without an override', () => {
    const book = makeBook()
    const { source } = effectiveGrid(book, book.spreads[0])
    expect(GRID_FIELDS.every((field) => source[field] === 'book')).toBe(true)
  })
})
