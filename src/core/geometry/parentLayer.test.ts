import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  resolveParentFrames,
  resolveSpread,
  setSpreadParent,
  type Book,
  type ParentSpread,
  type ResolvedItem,
} from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const parent = (overrides: Partial<ParentSpread> = {}): ParentSpread => ({
  id: 'p1',
  name: 'Master A',
  frames: [],
  guides: [],
  ...overrides,
})

const ids = (items: readonly ResolvedItem[]) => items.map((i) => i.frameId)
const parentItems = (items: readonly ResolvedItem[]) =>
  items.filter((item) => item.parent === true)

function items(book: Book, spreadId = 's1'): ResolvedItem[] {
  return resolveSpread(book, spreadId)?.items ?? []
}

describe('resolveSpread parent layer', () => {
  it('lists the applied parent frames first, flagged, above-z or not, then the spread frames as stored', () => {
    const book = makeBook({
      parents: [
        parent({
          frames: [makeFrame({ id: 'logo', z: 99, assetId: 'a1' })],
        }),
      ],
      spreads: [
        makeSpread({
          id: 's1',
          parentId: 'p1',
          frames: [makeFrame({ id: 'b', z: 2 }), makeFrame({ id: 'a', z: 1 })],
        }),
      ],
    })

    const resolved = items(book)

    expect(ids(resolved)).toEqual(['logo', 'b', 'a'])
    expect(resolved.map((item) => item.parent)).toEqual([
      true,
      undefined,
      undefined,
    ])
    expect(resolved[0]).toMatchObject({ assetId: 'a1', z: 99 })
  })

  it('None and a spread without a parent resolve no parent items', () => {
    const book = makeBook({
      parents: [parent({ frames: [makeFrame({ id: 'logo' })] })],
      defaultParentId: 'p1',
      spreads: [
        makeSpread({ id: 's1', parentId: null }),
        makeSpread({ id: 's2' }),
      ],
    })

    expect(parentItems(items(book, 's1'))).toEqual([])
    expect(ids(parentItems(items(book, 's2')))).toEqual(['logo'])
  })

  it('re-resolves the same spread object when its parent changes', () => {
    const book = makeBook({
      parents: [parent({ frames: [makeFrame({ id: 'logo' })] })],
      defaultParentId: 'p1',
      spreads: [makeSpread({ id: 's1', frames: [] })],
    })
    const moved: Book = {
      ...book,
      parents: [parent({ frames: [makeFrame({ id: 'logo2' })] })],
    }

    expect(ids(items(book))).toEqual(['logo'])
    expect(ids(items(moved))).toEqual(['logo2'])
  })

  it('applying a parent to two spreads paints its item on both; None removes it on one only', () => {
    const start = makeBook({
      parents: [parent({ frames: [makeFrame({ id: 'logo' })] })],
      spreads: [makeSpread({ id: 's1' }), makeSpread({ id: 's2' })],
    })

    const both = setSpreadParent(setSpreadParent(start, 's1', 'p1'), 's2', 'p1')
    const one = setSpreadParent(both, 's1', null)

    expect(ids(parentItems(items(both, 's1')))).toEqual(['logo'])
    expect(ids(parentItems(items(both, 's2')))).toEqual(['logo'])
    expect(parentItems(items(one, 's1'))).toEqual([])
    expect(ids(parentItems(items(one, 's2')))).toEqual(['logo'])
  })

  it('property: parent items are the resolver parent layer, before every spread frame, which stay as stored', () => {
    const z = fc.integer({ min: -3, max: 99 })
    const frames = (prefix: string) =>
      fc
        .array(z, { maxLength: 4 })
        .map((zs) =>
          zs.map((value, index) =>
            makeFrame({ id: `${prefix}${String(index)}`, z: value }),
          ),
        )
    const scenario = fc.record({
      parentFrames: frames('p'),
      ownFrames: frames('s'),
      parentId: fc.constantFrom(undefined, null, 'p1', 'gone'),
      defaultParentId: fc.constantFrom(undefined, 'p1', 'gone'),
      hidden: fc.boolean(),
    })
    fc.assert(
      fc.property(scenario, (s) => {
        const spread = makeSpread({
          id: 's1',
          ...(s.parentId === undefined ? {} : { parentId: s.parentId }),
          frames: s.ownFrames,
          ...(s.hidden ? { parentOverrides: { hiddenIds: ['p0'] } } : {}),
        })
        const book = makeBook({
          parents: [parent({ frames: s.parentFrames })],
          ...(s.defaultParentId === undefined
            ? {}
            : { defaultParentId: s.defaultParentId }),
          spreads: [spread],
        })

        const resolved = items(book)
        const inherited = resolveParentFrames(book, spread).filter(
          (entry) => entry.layer !== 'spread',
        )

        expect(ids(parentItems(resolved))).toEqual(
          inherited.map((entry) => entry.frame.id),
        )
        expect(ids(resolved)).toEqual([
          ...inherited.map((entry) => entry.frame.id),
          ...s.ownFrames.map((frame) => frame.id),
        ])
        expect(resolved.slice(inherited.length).every((i) => !i.parent)).toBe(
          true,
        )
      }),
      runs,
    )
  })
})
