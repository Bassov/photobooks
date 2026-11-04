import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  PARENT_SPREAD_INDEX,
  addParent,
  applyBookOp,
  editableSpread,
  ensureDefaultParent,
  getSpreadPageCount,
  nextParentId,
  parentAsSpread,
  removeParent,
  renameParent,
  resolveSpread,
  spreadParent,
  updateSpread,
  type Book,
  type ParentSpread,
  type Spread,
} from './index'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

const runs = { seed: gates.pbt.seed, numRuns: 200 }

const logo = makeFrame({
  id: 'logo',
  rect: { x: 20, y: 10, width: 30, height: 15 },
})

function parent(overrides: Partial<ParentSpread> = {}): ParentSpread {
  return { id: 'p1', name: 'Master A', frames: [], guides: [], ...overrides }
}

function spreads(count: number, extra: Partial<Spread> = {}): Spread[] {
  return Array.from({ length: count }, (_, i) =>
    makeSpread({ id: `spread-${String(i + 1)}`, ...extra }),
  )
}

/** Three spreads on parent `p1` (with a logo) and an empty `p2`. */
function bookWithLogo(overrides: Partial<Book> = {}): Book {
  return makeBook({
    spreads: spreads(3, { parentId: 'p1' }),
    parents: [
      parent({ frames: [logo] }),
      parent({ id: 'p2', name: 'Master B' }),
    ],
    ...overrides,
  })
}

function parentById(book: Book, id: string): ParentSpread | undefined {
  return book.parents?.find((item) => item.id === id)
}

describe('addParent', () => {
  it('appends an empty "Master A" with the first free parent id', () => {
    const book = makeBook()

    const next = addParent(book)

    expect(next.parents).toEqual([
      { id: 'parent-1', name: 'Master A', frames: [], guides: [] },
    ])
  })

  it('names the next free letter and skips ids taken by spreads or parents', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 'parent-2' })],
      parents: [parent({ id: 'parent-3', name: 'Master A' })],
    })

    const next = addParent(book)

    expect(nextParentId(book)).toBe('parent-4')
    expect(next.parents?.at(-1)).toMatchObject({
      id: 'parent-4',
      name: 'Master B',
    })
  })

  it('numbers masters once A–Z are taken', () => {
    const lettered = Array.from({ length: 26 }, (_, i) =>
      parent({
        id: `p${String(i)}`,
        name: `Master ${String.fromCharCode(65 + i)}`,
      }),
    )

    const next = addParent(makeBook({ parents: lettered }))

    expect(next.parents?.at(-1)?.name).toBe('Master 1')
  })

  it.each(['p1', 'spread-1'])('leaves the book when id %s is taken', (id) => {
    const book = bookWithLogo()

    expect(addParent(book, id)).toBe(book)
  })

  it('adds through applyBookOp with an explicit id', () => {
    const next = applyBookOp(makeBook(), { type: 'addParent', id: 'mine' })

    expect(next.parents?.map((item) => item.id)).toEqual(['mine'])
  })
})

describe('renameParent', () => {
  it('stores the trimmed name on that parent only', () => {
    const book = bookWithLogo()

    const next = applyBookOp(book, {
      type: 'renameParent',
      parentId: 'p2',
      name: '  Logo page ',
    })

    expect(next.parents?.map((item) => item.name)).toEqual([
      'Master A',
      'Logo page',
    ])
    expect(next.spreads).toBe(book.spreads)
  })

  it('leaves the stored parents array untouched', () => {
    const book = bookWithLogo()

    renameParent(book, 'p2', 'Logo page')

    expect(book.parents?.map((item) => item.name)).toEqual([
      'Master A',
      'Master B',
    ])
  })

  it.each([
    ['blank', 'p1', '   '],
    ['the same name', 'p1', 'Master A'],
    ['an unknown id', 'nope', 'X'],
  ])('leaves the book for %s', (_, id, name) => {
    const book = bookWithLogo()

    expect(renameParent(book, id, name)).toBe(book)
  })
})

describe('a book without parents', () => {
  const book = makeBook()

  it.each([
    ['rename', () => renameParent(book, 'p1', 'X')],
    ['delete', () => removeParent(book, 'p1')],
    [
      'an item op',
      () => updateSpread(book, 'p1', (spread) => ({ ...spread, frames: [] })),
    ],
  ])('%s on an unknown parent leaves it', (_, run) => {
    expect(run()).toBe(book)
  })
})

describe('removeParent', () => {
  it('drops the parent and its spreads fall back to None', () => {
    const book = bookWithLogo()

    const next = applyBookOp(book, { type: 'removeParent', parentId: 'p1' })

    expect(next.parents?.map((item) => item.id)).toEqual(['p2'])
    expect(next.spreads.map((spread) => spread.parentId)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(next.spreads.map((spread) => 'parentId' in spread)).toEqual([
      false,
      false,
      false,
    ])
  })

  it('stores None as null while another parent is the book default', () => {
    const book = bookWithLogo({ defaultParentId: 'p2' })

    const next = removeParent(book, 'p1')

    expect(next.defaultParentId).toBe('p2')
    expect(next.spreads.map((spread) => spread.parentId)).toEqual([
      null,
      null,
      null,
    ])
  })

  it('never deletes the book default', () => {
    const book = bookWithLogo({ defaultParentId: 'p1' })

    expect(removeParent(book, 'p1')).toBe(book)
    expect(applyBookOp(book, { type: 'removeParent', parentId: 'p1' })).toBe(
      book,
    )
  })

  it('leaves the book for an unknown id', () => {
    const book = bookWithLogo()

    expect(removeParent(book, 'nope')).toBe(book)
  })

  it('PBT: no spread resolves to the deleted parent; others keep theirs', () => {
    const choice = fc.constantFrom<string | null | undefined>(
      'p1',
      'p2',
      null,
      undefined,
    )
    fc.assert(
      fc.property(
        fc.array(choice, { minLength: 1, maxLength: 8 }),
        fc.constantFrom<string | undefined>('p1', 'p2', undefined),
        fc.constantFrom('p1', 'p2'),
        (choices, defaultParentId, gone) => {
          const book = makeBook({
            spreads: choices.map((parentId, i) =>
              makeSpread({
                id: `s${String(i)}`,
                ...(parentId === undefined ? {} : { parentId }),
              }),
            ),
            parents: [parent(), parent({ id: 'p2', name: 'Master B' })],
            ...(defaultParentId === undefined ? {} : { defaultParentId }),
          })

          const shown = (b: Book) =>
            b.spreads.map((spread) => spreadParent(b, spread)?.id)
          const before = shown(book)

          const next = removeParent(book, gone)

          expect(shown(next)).toEqual(
            gone === defaultParentId
              ? before
              : before.map((id) => (id === gone ? undefined : id)),
          )
        },
      ),
      runs,
    )
  })
})

describe('ensureDefaultParent', () => {
  it('gives a book without parents an empty default "Master A"', () => {
    const book = makeBook({ spreads: spreads(3) })

    const next = ensureDefaultParent(book)

    expect(next.parents).toEqual([
      { id: 'parent-1', name: 'Master A', frames: [], guides: [] },
    ])
    expect(next.defaultParentId).toBe('parent-1')
    expect(next.spreads).toBe(book.spreads)
    expect(next.spreads.map((s) => spreadParent(next, s)?.id)).toEqual([
      'parent-1',
      'parent-1',
      'parent-1',
    ])
  })

  it('appends the next free master when parents have no (known) default', () => {
    for (const extra of [{}, { defaultParentId: 'gone' }]) {
      const book = bookWithLogo(extra)

      const next = ensureDefaultParent(book)

      expect(next.parents?.map((item) => [item.id, item.name])).toEqual([
        ['p1', 'Master A'],
        ['p2', 'Master B'],
        ['parent-3', 'Master C'],
      ])
      expect(next.defaultParentId).toBe('parent-3')
      expect(next.spreads).toBe(book.spreads)
    }
  })

  it('keeps a book whose default names a parent', () => {
    const book = bookWithLogo({ defaultParentId: 'p2' })

    expect(ensureDefaultParent(book)).toBe(book)
  })
})

describe('setDefaultParent', () => {
  it('Make default: spreads without a stored parent follow the new default', () => {
    const book = makeBook({
      spreads: [...spreads(2), makeSpread({ id: 'own', parentId: 'p1' })],
      parents: [parent(), parent({ id: 'p2', name: 'Master B' })],
      defaultParentId: 'p1',
    })

    const next = applyBookOp(book, { type: 'setDefaultParent', parentId: 'p2' })

    expect(next.defaultParentId).toBe('p2')
    expect(next.spreads.map((s) => spreadParent(next, s)?.id)).toEqual([
      'p2',
      'p2',
      'p1',
    ])
  })

  it('never clears the default while the book has parents', () => {
    const book = bookWithLogo({ defaultParentId: 'p1' })

    expect(
      applyBookOp(book, { type: 'setDefaultParent', parentId: null }),
    ).toBe(book)
  })

  it('clears a stale default on a book without parents', () => {
    for (const parents of [undefined, []]) {
      const book = makeBook({
        spreads: spreads(1),
        defaultParentId: 'gone',
        ...(parents === undefined ? {} : { parents }),
      })

      const next = applyBookOp(book, {
        type: 'setDefaultParent',
        parentId: null,
      })

      expect('defaultParentId' in next).toBe(false)
    }
  })
})

describe('editableSpread', () => {
  it('finds a spread with its index', () => {
    const book = bookWithLogo()

    expect(editableSpread(book, 'spread-2')).toEqual({
      spread: book.spreads[1],
      index: 1,
    })
  })

  it('shows a parent as a two-page spread without a parent, one view per object', () => {
    const book = bookWithLogo()
    const p1 = parentById(book, 'p1')
    assert(p1 !== undefined, 'fixture parent p1')

    const found = editableSpread(book, 'p1')

    expect(found?.index).toBe(PARENT_SPREAD_INDEX)
    expect(found?.spread).toBe(parentAsSpread(p1))
    expect(found?.spread).toEqual({
      id: 'p1',
      parentId: null,
      frames: [logo],
      guides: [],
    })
    expect(Object.keys(found?.spread ?? {})).not.toContain('layoutGrid')
    expect(getSpreadPageCount(PARENT_SPREAD_INDEX, 1)).toBe(2)
  })

  it('carries the partial grid and misses unknown ids', () => {
    const book = makeBook({
      parents: [parent({ layoutGrid: { columns: 5 } })],
    })

    expect(editableSpread(book, 'p1')?.spread.layoutGrid).toEqual({
      columns: 5,
    })
    expect(editableSpread(book, 'nope')).toBeUndefined()
  })
})

describe('spread ops on a parent id', () => {
  it('moves the parent item; spreads stay as stored and resolve the new rect', () => {
    const book = bookWithLogo()

    const next = applyBookOp(book, {
      type: 'moveFrame',
      spreadId: 'p1',
      frameId: 'logo',
      dx: 15,
      dy: 5,
    })

    expect(parentById(next, 'p1')?.frames[0]?.rect).toEqual({
      x: 35,
      y: 15,
      width: 30,
      height: 15,
    })
    expect(next.spreads).toBe(book.spreads)
    expect(parentById(next, 'p2')).toBe(parentById(book, 'p2'))
  })

  it('adds and resizes items on a parent like on a spread', () => {
    const added = applyBookOp(bookWithLogo(), {
      type: 'addFrame',
      spreadId: 'p2',
      rect: { x: 0, y: 0, width: 40, height: 20 },
      id: 'mark',
    })

    const resized = applyBookOp(added, {
      type: 'resizeFrame',
      spreadId: 'p2',
      frameId: 'mark',
      rect: { x: 5, y: 5, width: 60, height: 30 },
    })

    expect(parentById(resized, 'p2')?.frames).toEqual([
      { id: 'mark', rect: { x: 5, y: 5, width: 60, height: 30 }, z: 1 },
    ])
  })

  it('writes guides and the partial grid back to the parent', () => {
    const guided = applyBookOp(bookWithLogo(), {
      type: 'addGuide',
      spreadId: 'p1',
      orientation: 'vertical',
      offsetMm: 40,
      id: 'g1',
    })
    const gridded = applyBookOp(guided, {
      type: 'setSpreadGrid',
      spreadId: 'p1',
      patch: { columns: 5 },
    })

    const reset = applyBookOp(gridded, {
      type: 'resetSpreadGrid',
      spreadId: 'p1',
    })

    expect(parentById(gridded, 'p1')?.guides.map((g) => g.id)).toEqual(['g1'])
    expect(parentById(gridded, 'p1')?.layoutGrid?.columns).toBe(5)
    expect('layoutGrid' in (parentById(reset, 'p1') ?? {})).toBe(false)
  })

  it('stores no guides when an edit drops the field', () => {
    const book = bookWithLogo({
      parents: [
        parent({ guides: [{ id: 'g', orientation: 'vertical', offsetMm: 9 }] }),
      ],
    })

    const next = updateSpread(book, 'p1', (spread) => {
      const rest = { ...spread }
      delete rest.guides
      return rest
    })

    expect(parentById(next, 'p1')?.guides).toEqual([])
  })

  it('ignores spread-only fields (background, parent) on a parent', () => {
    const book = bookWithLogo()

    expect(
      applyBookOp(book, {
        type: 'setSpreadBackground',
        spreadId: 'p1',
        color: '#112233',
      }),
    ).toBe(book)
  })

  it('PBT: one move of the parent item reaches every spread using it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: -10, max: 100 }),
        fc.integer({ min: -5, max: 100 }),
        (count, dx, dy) => {
          const book = makeBook({
            spreads: spreads(count, { parentId: 'p1' }),
            parents: [parent({ frames: [logo] })],
          })

          const next = applyBookOp(book, {
            type: 'moveFrame',
            spreadId: 'p1',
            frameId: 'logo',
            dx,
            dy,
          })

          const moved = parentById(next, 'p1')?.frames[0]?.rect
          const logos = next.spreads.map((spread) => {
            const item = resolveSpread(next, spread.id)?.items.find(
              (entry) => entry.frameId === 'logo',
            )
            return { parent: item?.parent, rectMm: item?.rectMm }
          })
          expect(logos).toEqual(
            next.spreads.map(() => ({ parent: true, rectMm: moved })),
          )
        },
      ),
      runs,
    )
  })
})

describe('resolveSpread on a parent id', () => {
  it.each([1, 2, 3])(
    'paints the parent as a two-page spread of its own items (%i spreads)',
    (count) => {
      const book = bookWithLogo({ spreads: spreads(count, { parentId: 'p1' }) })
      const { widthMm, heightMm } = book.settings.trim

      const resolved = resolveSpread(book, 'p1')

      expect(resolved?.spreadWidthMm).toBe(2 * widthMm)
      expect(resolved?.spreadHeightMm).toBe(heightMm)
      expect(
        resolved?.items.map((item) => [item.frameId, item.parent]),
      ).toEqual([['logo', undefined]])
    },
  )
})
