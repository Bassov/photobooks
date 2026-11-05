import { describe, expect, it } from 'vitest'
import type { Book, Spread } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  overrideCopyOf,
  overrideParentName,
  parentChanges,
} from './parentChanges'

const LOGO = makeFrame({ id: 'logo', z: 1, assetId: 'a1' })
const BOX = makeFrame({ id: 'box', z: 2 })
const TITLE = makeFrame({
  id: 'title',
  z: 3,
  kind: 'text',
  content: { type: 'static', text: 'A summer by the sea, 2026 edition' },
})

function bookWith(parentOverrides: Spread['parentOverrides']): Book {
  return makeBook({
    parents: [
      {
        id: 'm',
        name: 'Master A',
        frames: [LOGO, BOX, TITLE],
        guides: [
          { id: 'h1', orientation: 'horizontal', offsetMm: 63.14 },
          { id: 'v2', orientation: 'vertical', offsetMm: 150 },
          { id: 'v1', orientation: 'vertical', offsetMm: 74.2 },
          { id: 'v0', orientation: 'vertical', offsetMm: 20 },
        ],
      },
    ],
    defaultParentId: 'm',
    spreads: [
      makeSpread({ id: 'p1', frames: [] }),
      makeSpread({
        id: 's',
        frames: [],
        ...(parentOverrides === undefined ? {} : { parentOverrides }),
      }),
      makeSpread({ id: 'p9', frames: [] }),
    ],
  })
}

function rows(book: Book) {
  const spread = book.spreads[1]
  return spread === undefined
    ? []
    : parentChanges(book, spread).map(
        ({ parentItemId, state, name }) => `${parentItemId} ${state} ${name}`,
      )
}

describe('parentChanges', () => {
  it('is empty for a spread without overrides', () => {
    expect(rows(bookWith(undefined))).toEqual([])
  })

  it('lists overrides, hidden frames, then guides in the Designer order and names', () => {
    const book = bookWith({
      hiddenIds: ['h1', 'title', 'logo', 'v2', 'gone', 'v0'],
      frames: [
        { ...makeFrame({ id: 'c-logo', z: 1 }), overridesId: 'missing' },
        { ...BOX, id: 'c-box', assetId: 'a2', overridesId: 'box' },
      ],
      guides: [
        {
          id: 'g-h',
          orientation: 'horizontal',
          offsetMm: 10,
          overridesId: 'hx',
        },
        {
          id: 'g-v',
          orientation: 'vertical',
          offsetMm: 80.04,
          overridesId: 'v1',
        },
      ],
    })
    expect(rows(book)).toEqual([
      'box override Photo frame',
      'missing override Empty frame',
      'title hidden Text “A summer by the sea, 202”',
      'logo hidden Photo frame',
      'v1 override Guide · vertical 80 mm',
      'hx override Guide · horizontal 10 mm',
      'v0 hidden Guide · vertical 20 mm',
      'v2 hidden Guide · vertical 150 mm',
      'h1 hidden Guide · horizontal 63.1 mm',
    ])
  })

  it('lists copies without a parent; hidden ids need their parent item', () => {
    const book = bookWith({
      hiddenIds: ['logo', 'v1'],
      frames: [{ ...LOGO, id: 'c-logo', overridesId: 'logo' }],
    })
    const none = {
      ...book,
      spreads: book.spreads.map((spread) => ({ ...spread, parentId: null })),
    }
    expect(rows(none)).toEqual(['logo override Photo frame'])
  })

  it('drops a hidden guide off the spread page', () => {
    const book = bookWith({ hiddenIds: ['v2'] })
    const first = { ...book, spreads: book.spreads.slice(1, 2) }
    // A lone first page (right) shows parent verticals from the trim width on.
    const lone = first.spreads[0]
    expect(lone === undefined ? null : parentChanges(first, lone)).toEqual([])
  })
})

describe('overrideCopyOf / overrideParentName', () => {
  const book = bookWith({
    frames: [{ ...LOGO, id: 'c-logo', overridesId: 'logo' }],
  })

  it('finds a local copy and names its parent', () => {
    expect(
      overrideCopyOf(book, { spreadId: 's', frameId: 'c-logo' })?.overridesId,
    ).toBe('logo')
    expect(overrideParentName(book, { spreadId: 's', frameId: 'c-logo' })).toBe(
      'Master A',
    )
  })

  it('is empty for own frames, unknown spreads and parent spreads', () => {
    for (const target of [
      { spreadId: 's', frameId: 'logo' },
      { spreadId: 'x', frameId: 'c-logo' },
      { spreadId: 'm', frameId: 'logo' },
    ]) {
      expect(overrideCopyOf(book, target)).toBeUndefined()
      expect(overrideParentName(book, target)).toBeNull()
    }
    // A spread that only hides parent items has no copies to find.
    const hiding = bookWith({ hiddenIds: ['logo'] })
    const own = { spreadId: 's', frameId: 'logo' }
    expect(overrideCopyOf(hiding, own)).toBeUndefined()
    expect(overrideParentName(hiding, own)).toBeNull()
  })

  it('has no name once the spread has no parent', () => {
    const none = {
      ...book,
      spreads: book.spreads.map((spread) => ({ ...spread, parentId: null })),
    }
    expect(
      overrideParentName(none, { spreadId: 's', frameId: 'c-logo' }),
    ).toBeNull()
  })
})
