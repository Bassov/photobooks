import { describe, expect, it } from 'vitest'
import {
  GRID_FIELDS,
  clampGridValue,
  effectiveGrid,
  hasGridOverride,
} from '../grid/layoutGrid'
import { parseBook, serializeBook } from '../parse'
import { applyTemplate } from '../templates/apply'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { applyBookOp } from './applyBookOp'

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
    expect(spread?.layoutGrid).toEqual({ columns: 5, margins: { left: 22 } })
    const { values, source } = effectiveGrid(next, spread)
    expect(values.columns).toBe(5)
    expect(values.inside).toBe(22)
    expect(values.outside).toBe(next.layoutGrid.margins.right)
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
      book: { spreads: [{}, { layoutGrid: { margins: { right: 9 } } }, {}] },
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

describe('effectiveGrid', () => {
  it('reports every field as BOOK without an override', () => {
    const book = makeBook()
    const { source } = effectiveGrid(book, book.spreads[0])
    expect(GRID_FIELDS.every((field) => source[field] === 'book')).toBe(true)
  })
})
