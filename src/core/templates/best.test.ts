import { describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../testing/fixtures'
import type { AspectClass } from './aspect'
import { bestTemplateId } from './best'
import type { LayoutSlotPct, SavedTemplate } from './custom'

function interiorBook() {
  return makeBook({
    spreads: [
      makeSpread({ id: 'a' }),
      makeSpread({ id: 'b' }),
      makeSpread({ id: 'c' }),
    ],
  })
}

// Thin and flat enough to stay portrait / landscape on any trim.
const TALL: LayoutSlotPct = { x: 0, y: 0, w: 5, h: 90 }
const WIDE: LayoutSlotPct = { x: 0, y: 0, w: 90, h: 5 }

function saved(
  id: string,
  shape: readonly AspectClass[],
  pages: 1 | 2 = 2,
): SavedTemplate {
  return {
    id,
    name: id,
    pages,
    slots: shape.map((aspect) => (aspect === 'portrait' ? TALL : WIDE)),
  }
}

// Alternating orientations: no builtin matches them all.
const MIXED: AspectClass[] = [
  'portrait',
  'landscape',
  'portrait',
  'landscape',
  'portrait',
]

describe('bestTemplateId with saved templates', () => {
  it('a saved template that scores strictly better wins', () => {
    expect(
      bestTemplateId(interiorBook(), 1, MIXED, [saved('user-fit', MIXED)]),
    ).toBe('user-fit')
  })

  it('an equal score keeps the builtin', () => {
    const pair: AspectClass[] = ['portrait', 'portrait']
    expect(
      bestTemplateId(interiorBook(), 1, pair, [saved('user-pair', pair)]),
    ).toBe('two-portraits')
  })

  it('an equal score between saved templates keeps the first saved', () => {
    const list = [saved('user-first', MIXED), saved('user-second', MIXED)]
    expect(bestTemplateId(interiorBook(), 1, MIXED, list)).toBe('user-first')
  })

  it('a later saved template that scores strictly better wins', () => {
    const list = [
      saved('user-spare', [...MIXED, 'portrait']),
      saved('user-exact', MIXED),
    ]
    expect(bestTemplateId(interiorBook(), 1, MIXED, list)).toBe('user-exact')
  })

  it('never picks a saved template of another page count', () => {
    const book = interiorBook()
    const builtin = bestTemplateId(book, 1, MIXED, [])
    expect(bestTemplateId(book, 1, MIXED, [saved('user-page', MIXED, 1)])).toBe(
      builtin,
    )
    const single = makeBook()
    expect(
      bestTemplateId(single, 0, MIXED, [saved('user-spread', MIXED, 2)]),
    ).toBe(bestTemplateId(single, 0, MIXED, []))
    expect(
      bestTemplateId(single, 0, MIXED, [saved('user-page', MIXED, 1)]),
    ).toBe('user-page')
  })

  it('skips a saved template with fewer slots than photos', () => {
    const book = interiorBook()
    expect(
      bestTemplateId(book, 1, MIXED, [saved('user-short', MIXED.slice(1))]),
    ).toBe(bestTemplateId(book, 1, MIXED, []))
  })

  it('returns one-per-page for no photos', () => {
    expect(
      bestTemplateId(interiorBook(), 1, [], [saved('user-fit', MIXED)]),
    ).toBe('one-per-page')
  })
})
