import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  type Book,
  type Frame,
  type ParentSpread,
  type Spread,
  applyBookOp,
  resolveParentFrames,
  resolveParentGrid,
  resolveParentGuides,
  spreadParent,
} from './index'
import { omitKey } from './omitKey'
import type { Guide } from './ops/guides'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

/** The item asks for ≥1000 runs per resolver property. */
const runs = {
  seed: gates.pbt.seed,
  numRuns: Math.max(1000, Number(process.env.FC_NUM_RUNS ?? 1000)),
}

function guide(id: string, offsetMm = 10): Guide {
  return { id, orientation: 'vertical', offsetMm }
}

function parent(overrides: Partial<ParentSpread> = {}): ParentSpread {
  return { id: 'p1', name: 'A', frames: [], guides: [], ...overrides }
}

function bookWith(spread: Spread, overrides: Partial<Book> = {}): Book {
  return makeBook({ spreads: [spread], ...overrides })
}

const ids = (frames: readonly { frame: Frame }[]) =>
  frames.map(({ frame }) => frame.id)

describe('spreadParent', () => {
  const parents = [parent({ id: 'p1' }), parent({ id: 'p2' })]

  it('uses the spread parentId over the book default', () => {
    const spread = makeSpread({ parentId: 'p2' })
    const book = bookWith(spread, { parents, defaultParentId: 'p1' })
    expect(spreadParent(book, spread)?.id).toBe('p2')
  })

  it('falls back to the book default when parentId is absent', () => {
    const spread = makeSpread()
    const book = bookWith(spread, { parents, defaultParentId: 'p2' })
    expect(spreadParent(book, spread)?.id).toBe('p2')
  })

  it('resolves None (null), an unknown id and a book without parents to none', () => {
    const none = makeSpread({ parentId: null })
    const unknown = makeSpread({ parentId: 'gone' })
    const book = bookWith(none, { parents, defaultParentId: 'p1' })
    expect(spreadParent(book, none)).toBeUndefined()
    expect(spreadParent(book, unknown)).toBeUndefined()
    expect(spreadParent(makeBook(), makeSpread())).toBeUndefined()
  })
})

describe('resolveParentGrid', () => {
  it('is the book grid for parent None', () => {
    const spread = makeSpread({ parentId: null })
    const book = bookWith(spread, {
      parents: [parent({ layoutGrid: { columns: 5 } })],
      defaultParentId: 'p1',
    })
    expect(resolveParentGrid(book, spread)).toEqual(book.layoutGrid)
  })

  it('chains book → parent → spread per field', () => {
    const spread = makeSpread({
      parentId: 'p1',
      layoutGrid: { rows: 4, margins: { top: 30 } },
    })
    const book = bookWith(spread, {
      parents: [
        parent({ layoutGrid: { columns: 6, rows: 3, margins: { top: 1 } } }),
      ],
    })
    expect(resolveParentGrid(book, spread)).toEqual({
      ...book.layoutGrid,
      columns: 6,
      rows: 4,
      margins: { ...book.layoutGrid.margins, top: 30 },
    })
  })
})

describe('resolveParentFrames', () => {
  const parentFrames = [
    makeFrame({ id: 'top', z: 2 }),
    makeFrame({ id: 'hidden', z: 1 }),
    makeFrame({ id: 'replaced', z: 0 }),
    makeFrame({ id: 'bottom', z: -1 }),
  ]

  it('drops hidden and overridden parent frames and stacks the spread on top', () => {
    const spread = makeSpread({
      parentId: 'p1',
      parentOverrides: {
        hiddenIds: ['hidden'],
        frames: [
          { ...makeFrame({ id: 'copy-b', z: 9 }), overridesId: 'replaced' },
          { ...makeFrame({ id: 'copy-a', z: 3 }), overridesId: 'replaced' },
        ],
      },
      frames: [
        makeFrame({ id: 'own-b', z: 1 }),
        makeFrame({ id: 'own-a', z: -9 }),
      ],
    })
    const book = bookWith(spread, {
      parents: [parent({ frames: parentFrames })],
    })
    const resolved = resolveParentFrames(book, spread)
    expect(ids(resolved)).toEqual([
      'bottom',
      'top',
      'copy-a',
      'copy-b',
      'own-a',
      'own-b',
    ])
    expect(resolved.map(({ layer }) => layer)).toEqual([
      'parent',
      'parent',
      'override',
      'override',
      'spread',
      'spread',
    ])
  })

  it('keeps a local copy whose parent frame is gone', () => {
    const spread = makeSpread({
      parentId: null,
      parentOverrides: {
        frames: [{ ...makeFrame({ id: 'copy' }), overridesId: 'gone' }],
      },
      frames: [],
    })
    expect(ids(resolveParentFrames(bookWith(spread), spread))).toEqual(['copy'])
  })

  it('is the spread frames alone without a parent or overrides', () => {
    const spread = makeSpread()
    expect(resolveParentFrames(bookWith(spread), spread)).toEqual([
      { frame: spread.frames[0], layer: 'spread' },
    ])
  })
})

describe('resolveParentGuides', () => {
  it('drops hidden and overridden parent guides, then copies, then the spread', () => {
    const spread = makeSpread({
      parentId: 'p1',
      guides: [guide('own')],
      parentOverrides: {
        hiddenIds: ['g-hidden'],
        guides: [{ ...guide('copy', 30), overridesId: 'g-replaced' }],
      },
    })
    const book = bookWith(spread, {
      parents: [
        parent({
          guides: [guide('g-kept'), guide('g-hidden'), guide('g-replaced')],
        }),
      ],
    })
    expect(resolveParentGuides(book, spread)).toEqual([
      { guide: guide('g-kept'), layer: 'parent' },
      {
        guide: { ...guide('copy', 30), overridesId: 'g-replaced' },
        layer: 'override',
      },
      { guide: guide('own'), layer: 'spread' },
    ])
  })

  it('is empty without a parent, overrides or spread guides', () => {
    const spread = makeSpread()
    expect(resolveParentGuides(bookWith(spread), spread)).toEqual([])
  })
})

describe('parent resolution (property)', () => {
  const frameIds = ['f1', 'f2', 'f3', 'f4', 'f5']
  const guideIds = ['g1', 'g2', 'g3', 'g4']
  const z = fc.integer({ min: -3, max: 3 })
  const count = fc.integer({ min: 1, max: 12 })
  const gridOverride = fc.record(
    {
      columns: count,
      rows: count,
      columnGutterMm: fc.integer({ min: 0, max: 20 }),
      margins: fc.record(
        { top: fc.integer({ min: 0, max: 40 }) },
        { requiredKeys: [] },
      ),
    },
    { requiredKeys: [] },
  )
  const framesFrom = (pool: readonly string[]) =>
    fc
      .uniqueArray(fc.constantFrom(...pool), { maxLength: pool.length })
      .chain((chosen) =>
        fc.tuple(
          ...chosen.map((id) => z.map((value) => makeFrame({ id, z: value }))),
        ),
      )
  const guidesFrom = (pool: readonly string[]) =>
    fc
      .uniqueArray(fc.constantFrom(...pool), { maxLength: pool.length })
      .map((chosen) => chosen.map((id) => guide(id)))
  const scenario = fc.record({
    parentFrames: framesFrom(frameIds),
    parentGuides: guidesFrom(guideIds),
    parentGrid: fc.option(gridOverride, { nil: undefined }),
    spreadGrid: fc.option(gridOverride, { nil: undefined }),
    parentId: fc.constantFrom(undefined, null, 'p1', 'gone'),
    defaultParentId: fc.constantFrom(undefined, 'p1', 'gone'),
    hiddenIds: fc.subarray([...frameIds, ...guideIds]),
    frameCopies: fc.subarray(frameIds),
    guideCopies: fc.subarray(guideIds),
    ownFrames: framesFrom(['s1', 's2', 's3']),
    ownGuides: guidesFrom(['sg1', 'sg2']),
  })

  function build(s: Scenario) {
    const spread = makeSpread({
      ...(s.parentId === undefined ? {} : { parentId: s.parentId }),
      ...(s.spreadGrid === undefined ? {} : { layoutGrid: s.spreadGrid }),
      frames: s.ownFrames,
      guides: s.ownGuides,
      parentOverrides: {
        hiddenIds: s.hiddenIds,
        frames: s.frameCopies.map((id) => ({
          ...makeFrame({ id: `copy-${id}` }),
          overridesId: id,
        })),
        guides: s.guideCopies.map((id) => ({
          ...guide(`copy-${id}`),
          overridesId: id,
        })),
      },
    })
    const book = bookWith(spread, {
      parents: [
        parent({
          frames: s.parentFrames,
          guides: s.parentGuides,
          ...(s.parentGrid === undefined ? {} : { layoutGrid: s.parentGrid }),
        }),
      ],
      ...(s.defaultParentId === undefined
        ? {}
        : { defaultParentId: s.defaultParentId }),
    })
    const parentApplies =
      (s.parentId === undefined ? s.defaultParentId : s.parentId) === 'p1'
    return { book, spread, parentApplies }
  }

  it('parent None (or unknown) yields the book grid under the spread override', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, spread, parentApplies } = build(s)
        const grid = resolveParentGrid(book, spread)
        const parentGrid = parentApplies ? s.parentGrid : undefined
        expect(grid.columns).toBe(
          s.spreadGrid?.columns ??
            parentGrid?.columns ??
            book.layoutGrid.columns,
        )
        expect(grid.margins.top).toBe(
          s.spreadGrid?.margins?.top ??
            parentGrid?.margins?.top ??
            book.layoutGrid.margins.top,
        )
        if (!parentApplies && s.spreadGrid === undefined) {
          expect(grid).toEqual(book.layoutGrid)
        }
      }),
      runs,
    )
  })

  it('hidden / overridden parent items never appear; spread items are always on top', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, spread, parentApplies } = build(s)
        const suppressed = new Set([...s.hiddenIds, ...s.frameCopies])
        const resolved = resolveParentFrames(book, spread)
        const inherited = resolved.filter(({ layer }) => layer === 'parent')
        expect(inherited.some(({ frame }) => suppressed.has(frame.id))).toBe(
          false,
        )
        expect(new Set(ids(inherited))).toEqual(
          new Set(
            parentApplies
              ? s.parentFrames
                  .map(({ id }) => id)
                  .filter((id) => !suppressed.has(id))
              : [],
          ),
        )
        const own = resolved.slice(resolved.length - s.ownFrames.length)
        expect(own.every(({ layer }) => layer === 'spread')).toBe(true)
        expect(new Set(ids(own))).toEqual(
          new Set(s.ownFrames.map(({ id }) => id)),
        )
        expect(resolved).toHaveLength(
          inherited.length + s.frameCopies.length + s.ownFrames.length,
        )
        const rank = { parent: 0, override: 1, spread: 2 }
        for (let i = 1; i < resolved.length; i += 1) {
          const prev = resolved[i - 1]
          const next = resolved[i]
          if (prev === undefined || next === undefined) continue
          expect(rank[prev.layer]).toBeLessThanOrEqual(rank[next.layer])
          if (prev.layer === next.layer) {
            expect(prev.frame.z).toBeLessThanOrEqual(next.frame.z)
          }
        }
      }),
      runs,
    )
  })

  it('guides are parent guides minus hidden / overridden, then copies, then the spread', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { book, spread, parentApplies } = build(s)
        const suppressed = new Set([...s.hiddenIds, ...s.guideCopies])
        const kept = parentApplies
          ? s.parentGuides.filter(({ id }) => !suppressed.has(id))
          : []
        expect(
          resolveParentGuides(book, spread).map(({ guide: g }) => g.id),
        ).toEqual([
          ...kept.map(({ id }) => id),
          ...s.guideCopies.map((id) => `copy-${id}`),
          ...s.ownGuides.map(({ id }) => id),
        ])
      }),
      runs,
    )
  })
})

interface Scenario {
  parentFrames: Frame[]
  parentGuides: Guide[]
  parentGrid: Spread['layoutGrid']
  spreadGrid: Spread['layoutGrid']
  parentId: string | null | undefined
  defaultParentId: string | undefined
  hiddenIds: string[]
  frameCopies: string[]
  guideCopies: string[]
  ownFrames: Frame[]
  ownGuides: Guide[]
}

describe('parent overrides ops (property)', () => {
  const parentFrameIds = ['logo', 'folio', 'band', 'mark'] as const
  const parentGuideIds = ['pg1', 'pg2', 'pg3'] as const
  const parentItemIds = [...parentFrameIds, ...parentGuideIds]
  const z = fc.integer({ min: -5, max: 5 })
  const scenario = fc.record({
    parentZ: fc.array(z, { minLength: 4, maxLength: 4 }),
    ownZ: fc.array(z, { maxLength: 4 }),
    ownGuides: fc.integer({ min: 0, max: 2 }),
    templated: fc.boolean(),
    viaDefault: fc.boolean(),
    hidden: fc.subarray(parentItemIds),
    copied: fc.subarray(parentItemIds),
    copyZ: z,
  })
  const pick = fc.constantFrom(...parentItemIds)

  type OverridesScenario =
    typeof scenario extends fc.Arbitrary<infer T> ? T : never

  /** Spread `s1` on Master `p1` (stored or the book default) with normalised overrides. */
  function build(s: OverridesScenario): Book {
    const copied = s.copied.filter((id) => !s.hidden.includes(id))
    const isFrame = (id: string) =>
      (parentFrameIds as readonly string[]).includes(id)
    const overrides = {
      hiddenIds: s.hidden,
      frames: copied.filter(isFrame).map((id, i) => ({
        ...makeFrame({ id: `own-copy-${id}`, z: s.copyZ + i }),
        overridesId: id,
      })),
      guides: copied
        .filter((id) => !isFrame(id))
        .map((id) => ({ ...guide(`own-copy-${id}`, 40), overridesId: id })),
    }
    const parentOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([, list]) => list.length > 0),
    )
    const spread = makeSpread({
      id: 's1',
      frames: s.ownZ.map((zValue, i) =>
        makeFrame({ id: `own-${String(i)}`, z: zValue }),
      ),
      ...(s.ownGuides === 0
        ? {}
        : {
            guides: Array.from({ length: s.ownGuides }, (_, i) =>
              guide(`g-${String(i)}`, 5 + i),
            ),
          }),
      ...(s.templated ? { templateId: 'not-a-template' } : {}),
      ...(s.viaDefault ? {} : { parentId: 'p1' }),
      ...(Object.keys(parentOverrides).length === 0 ? {} : { parentOverrides }),
    })
    return bookWith(spread, {
      parents: [
        parent({
          frames: parentFrameIds.map((id, i) =>
            makeFrame({ id, z: s.parentZ[i] ?? 0 }),
          ),
          guides: parentGuideIds.map((id, i) => guide(id, 20 + i)),
        }),
        parent({ id: 'p2', name: 'B' }),
      ],
      ...(s.viaDefault ? { defaultParentId: 'p1' } : {}),
    })
  }

  const spreadOf = (book: Book): Spread => {
    const spread = book.spreads[0]
    if (spread === undefined) {
      throw new Error('no spread')
    }
    return spread
  }

  const suppressed = (book: Book, id: string) => {
    const overrides = spreadOf(book).parentOverrides
    return [
      ...(overrides?.hiddenIds ?? []),
      ...(overrides?.frames ?? []).map((copy) => copy.overridesId),
      ...(overrides?.guides ?? []).map((copy) => copy.overridesId),
    ].includes(id)
  }

  const override = (book: Book, id: string) =>
    (parentFrameIds as readonly string[]).includes(id)
      ? applyBookOp(book, {
          type: 'overrideParentFrame',
          spreadId: 's1',
          parentFrameId: id,
        })
      : applyBookOp(book, {
          type: 'overrideParentGuide',
          spreadId: 's1',
          parentGuideId: id,
        })

  const reset = (book: Book, id: string) =>
    applyBookOp(book, {
      type: 'resetParentItem',
      spreadId: 's1',
      parentItemId: id,
    })

  /** Every resolved item id with its layer. */
  const resolvedItems = (book: Book) => {
    const spread = spreadOf(book)
    return [
      ...resolveParentFrames(book, spread).map(({ frame, layer }) => ({
        id: frame.id,
        layer,
        overridesId: (frame as { overridesId?: string }).overridesId,
      })),
      ...resolveParentGuides(book, spread).map(({ guide: item, layer }) => ({
        id: item.id,
        layer,
        overridesId: (item as { overridesId?: string }).overridesId,
      })),
    ]
  }

  it('override then reset restores the spread; a suppressed item leaves the book', () => {
    fc.assert(
      fc.property(scenario, pick, (s, id) => {
        const book = build(s)
        const overridden = override(book, id)
        if (suppressed(book, id)) {
          expect(overridden).toBe(book)
          return
        }
        const items = resolvedItems(overridden)
        expect(items).not.toContainEqual(
          expect.objectContaining({ id, layer: 'parent' }),
        )
        expect(items).toContainEqual(
          expect.objectContaining({ layer: 'override', overridesId: id }),
        )
        expect(reset(overridden, id)).toStrictEqual(book)
      }),
      runs,
    )
  })

  it('hide hides the item and its copy; reset brings the parent item back', () => {
    fc.assert(
      fc.property(scenario, pick, (s, id) => {
        const book = build(s)
        const hidden = applyBookOp(book, {
          type: 'hideParentItem',
          spreadId: 's1',
          parentItemId: id,
        })
        const items = resolvedItems(hidden)
        expect(items.some((item) => item.id === id)).toBe(false)
        expect(items.some((item) => item.overridesId === id)).toBe(false)
        expect(spreadOf(hidden).parentOverrides?.hiddenIds).toContain(id)
        const back = resolvedItems(reset(hidden, id))
        expect(back).toContainEqual(
          expect.objectContaining({ id, layer: 'parent' }),
        )
        if (!suppressed(book, id)) {
          expect(reset(hidden, id)).toStrictEqual(book)
        }
      }),
      runs,
    )
  })

  it('reset spread to parent drops every override', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const book = build(s)
        const next = applyBookOp(book, {
          type: 'resetSpreadToParent',
          spreadId: 's1',
        })
        if (spreadOf(book).parentOverrides === undefined) {
          expect(next).toBe(book)
          return
        }
        expect(spreadOf(next)).toStrictEqual(
          omitKey(spreadOf(book), 'parentOverrides'),
        )
        expect(
          resolvedItems(next).filter(({ layer }) => layer === 'parent'),
        ).toHaveLength(parentItemIds.length)
      }),
      runs,
    )
  })

  it('a parent switch keeps copies as own frames below the own frames, in order', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.constantFrom<string | null>(null, 'p2'),
        (s, target) => {
          const book = build(s)
          const before = spreadOf(book)
          const next = applyBookOp(book, {
            type: 'setSpreadParent',
            spreadId: 's1',
            parentId: target,
          })
          const after = spreadOf(next)
          expect(after.parentOverrides).toBeUndefined()
          const copies = (before.parentOverrides?.frames ?? []).toSorted(
            (a, b) => a.z - b.z,
          )
          const kept = after.frames.slice(0, copies.length)
          expect(kept.map((frame) => frame.id)).toEqual(
            copies.map((copy) => copy.id),
          )
          expect(kept.every((frame) => !('overridesId' in frame))).toBe(true)
          for (const [i, frame] of kept.entries()) {
            expect(frame.rect).toEqual(copies[i]?.rect)
            if (i > 0) {
              expect(frame.z).toBeGreaterThan(kept[i - 1]?.z ?? Infinity)
            }
          }
          const own = after.frames.slice(copies.length)
          expect(own).toEqual(before.frames)
          own.forEach((frame, i) => {
            expect(frame).toBe(before.frames[i])
          })
          const lowest = Math.min(...own.map((frame) => frame.z))
          expect(kept.every((frame) => frame.z < lowest)).toBe(true)
          expect('templateId' in after).toBe(s.templated && copies.length === 0)
          const copyGuides = (before.parentOverrides?.guides ?? []).map(
            (copy) => copy.id,
          )
          expect((after.guides ?? []).map((item) => item.id)).toEqual([
            ...(before.guides ?? []).map((item) => item.id),
            ...copyGuides,
          ])
        },
      ),
      runs,
    )
  })

  it('frame ops edit a copy in place and keep the template', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.constantFrom(...parentFrameIds),
        fc.integer({ min: 1, max: 20 }),
        (s, id, dx) => {
          const book = build({ ...s, hidden: [], copied: [] })
          const overridden = applyBookOp(book, {
            type: 'overrideParentFrame',
            spreadId: 's1',
            parentFrameId: id,
            id: 'mine',
          })
          const moved = applyBookOp(overridden, {
            type: 'moveFrame',
            spreadId: 's1',
            frameId: 'mine',
            dx,
            dy: 0,
          })
          const copy = spreadOf(moved).parentOverrides?.frames?.[0]
          expect(copy?.overridesId).toBe(id)
          expect(copy?.rect.x).toBe(10 + dx)
          expect(spreadOf(moved).frames).toBe(spreadOf(book).frames)
          expect(spreadOf(moved).templateId).toBe(spreadOf(book).templateId)
          expect(moved.parents).toBe(book.parents)
        },
      ),
      runs,
    )
  })
})
