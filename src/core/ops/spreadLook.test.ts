import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { spreadParent } from '../parentSpreads'
import { parseBook } from '../parse'
import type { Book, ParentSpread, Spread } from '../schema'
import { applyTemplate } from '../templates/apply'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { applyBookOp } from './applyBookOp'
import { setSpreadBackground, setSpreadParent } from './spreadLook'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const book = () =>
  makeBook({ spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })] })

const parent = (id: string): ParentSpread => ({
  id,
  name: `Master ${id}`,
  frames: [],
  guides: [],
})

/** Spreads a / b with parents p1 / p2; `defaultParentId` as given. */
const withParents = (defaultParentId?: string): Book => ({
  ...book(),
  parents: [parent('p1'), parent('p2')],
  ...(defaultParentId === undefined ? {} : { defaultParentId }),
})

describe('setSpreadBackground', () => {
  it('sets one spread’s color and clears it back to the page default', () => {
    const start = book()
    const dark = setSpreadBackground(start, 'a', '#2a2927')
    expect(dark.spreads[0]?.backgroundColor).toBe('#2a2927')
    expect(dark.spreads[1]).toBe(start.spreads[1])
    const cleared = setSpreadBackground(dark, 'a', undefined)
    expect(cleared.spreads[0]).toBeDefined()
    expect(cleared.spreads[0]).not.toHaveProperty('backgroundColor')
  })

  it('returns the same book for the same color or an unknown spread', () => {
    const dark = setSpreadBackground(book(), 'a', '#111111')
    expect(setSpreadBackground(dark, 'a', '#111111')).toBe(dark)
    expect(setSpreadBackground(dark, 'zzz', '#ffffff')).toBe(dark)
    const plain = book()
    expect(setSpreadBackground(plain, 'a', undefined)).toBe(plain)
  })

  it('is the setSpreadBackground book op', () => {
    const next = applyBookOp(book(), {
      type: 'setSpreadBackground',
      spreadId: 'b',
      color: '#f4f4f4',
    })
    expect(next.spreads[1]?.backgroundColor).toBe('#f4f4f4')
  })
})

describe('setSpreadParent', () => {
  it('without a book default stores the parent and drops the field for None', () => {
    const start = withParents()

    const applied = setSpreadParent(start, 'a', 'p1')
    const none = setSpreadParent(applied, 'a', null)
    const again = setSpreadParent(none, 'a', 'p1')

    expect(applied.spreads[0]?.parentId).toBe('p1')
    expect(applied.spreads[1]).toBe(start.spreads[1])
    expect(none.spreads[0]).toBeDefined()
    expect(none.spreads[0]).not.toHaveProperty('parentId')
    expect(again.spreads[0]?.parentId).toBe('p1')
  })

  it('with a book default stores null for None and drops the field for the default', () => {
    const start = withParents('p1')

    const none = setSpreadParent(start, 'a', null)
    const other = setSpreadParent(none, 'a', 'p2')
    const back = setSpreadParent(other, 'a', 'p1')

    expect(none.spreads[0]?.parentId).toBeNull()
    expect(other.spreads[0]?.parentId).toBe('p2')
    expect(back.spreads[0]).toBeDefined()
    expect(back.spreads[0]).not.toHaveProperty('parentId')
  })

  it('returns the same book for an unknown parent or spread, or the current parent', () => {
    const start = setSpreadParent(withParents(), 'a', 'p1')

    expect(setSpreadParent(start, 'a', 'gone')).toBe(start)
    expect(setSpreadParent(start, 'zzz', 'p2')).toBe(start)
    expect(setSpreadParent(start, 'a', 'p1')).toBe(start)
    expect(setSpreadParent(start, 'b', null)).toBe(start)
    const plain = book()
    expect(setSpreadParent(plain, 'a', 'p1')).toBe(plain)
  })

  const scenario = fc.record({
    defaultParentId: fc.constantFrom(undefined, 'p1', 'p2', 'gone'),
    stored: fc.constantFrom(undefined, null, 'p1', 'p2', 'gone'),
    target: fc.constantFrom(null, 'p1', 'p2'),
  })

  /** Spread a stores `stored` (absent when undefined); spread b untouched. */
  const startBook = (defaultParentId?: string, stored?: string | null) => {
    const base = withParents(defaultParentId)
    return {
      ...base,
      spreads: [
        makeSpread({
          id: 'a',
          ...(stored === undefined ? {} : { parentId: stored }),
        }),
        ...base.spreads.slice(1),
      ],
    }
  }

  const first = (target: Book): Spread => {
    const spread = target.spreads[0]
    if (spread === undefined) throw new Error('book without spreads')
    return spread
  }

  it('makes the target the effective parent and touches no other spread', () => {
    fc.assert(
      fc.property(scenario, ({ defaultParentId, stored, target }) => {
        const start = startBook(defaultParentId, stored)

        const next = setSpreadParent(start, 'a', target)

        expect(spreadParent(next, first(next))?.id ?? null).toBe(target)
        expect(next.spreads[1]).toBe(start.spreads[1])
      }),
      runs,
    )
  })

  it('on a change stores parentId only when it differs from what absent resolves to', () => {
    fc.assert(
      fc.property(scenario, ({ defaultParentId, stored, target }) => {
        const start = startBook(defaultParentId, stored)

        const next = setSpreadParent(start, 'a', target)
        fc.pre(next !== start)
        const spread = first(next)
        const inherited = spreadParent(next, { ...spread, parentId: undefined })

        expect('parentId' in spread).toBe((inherited?.id ?? null) !== target)
      }),
      runs,
    )
  })

  it('is the setSpreadParent book op and None survives a save / load', () => {
    const next = applyBookOp(withParents('p1'), {
      type: 'setSpreadParent',
      spreadId: 'b',
      parentId: null,
    })

    const parsed = parseBook(JSON.parse(JSON.stringify(next)))

    expect(parsed.ok && parsed.book.spreads[1]?.parentId).toBeNull()
  })

  it('re-aligns the templated spread to its new parent grid, keeping placements', () => {
    const raw: Book = {
      ...makeBook({
        assets: { p: {} },
        gallery: ['p'],
        spreads: [
          makeSpread({
            id: 'a',
            templateId: '2-up',
            frames: [makeFrame({ id: 'a-f0', assetId: 'p' })],
          }),
          makeSpread({ id: 'b', templateId: '2-up' }),
        ],
      }),
      parents: [
        { ...parent('p1'), layoutGrid: { columnGutterMm: 30 } },
        parent('p2'),
      ],
    }
    const start = ['a', 'b'].reduce(
      (acc, id) => applyTemplate(acc, id, '2-up'),
      raw,
    )

    const applied = applyBookOp(start, {
      type: 'setSpreadParent',
      spreadId: 'a',
      parentId: 'p1',
    })
    const back = applyBookOp(applied, {
      type: 'setSpreadParent',
      spreadId: 'a',
      parentId: null,
    })

    const rect = (b: Book) => b.spreads[0]?.frames[0]?.rect
    expect(rect(applied)).not.toEqual(rect(start))
    expect(applied.spreads[0]?.frames[0]?.assetId).toBe('p')
    expect(applyTemplate(applied, 'a', '2-up')).toBe(applied)
    expect(applied.spreads[1]).toBe(start.spreads[1])
    expect(rect(back)).toEqual(rect(start))
    // `raw` is not aligned yet: keeping the parent must not re-align it.
    expect(setSpreadParent(raw, 'a', null)).toBe(raw)
  })

  it('drops a stored legacy masterId at load', () => {
    const old = JSON.parse(JSON.stringify(book())) as {
      spreads: Record<string, unknown>[]
    }
    old.spreads[0] = { ...old.spreads[0], masterId: 'B' }

    const parsed = parseBook(old)

    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.book.spreads[0]).not.toHaveProperty('masterId')
  })
})
