import { describe, expect, it } from 'vitest'
import {
  applyBookOp,
  placementCountByAsset,
  type Book,
  type BookOp,
  type Frame,
  type ParentSpread,
  type Spread,
} from './index'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

const logo = makeFrame({ id: 'logo', z: 0, assetId: 'a1' })

function master(id = 'p1'): ParentSpread {
  return {
    id,
    name: id,
    frames: [logo],
    guides: [{ id: 'pg', orientation: 'vertical', offsetMm: 30 }],
  }
}

/** Spread `s1` on Master `p1` with one own frame, templated; `copy` overrides the logo. */
function overriddenBook(extra: Partial<Book> = {}): Book {
  const book = makeBook({
    assets: { a1: {}, a2: {} },
    gallery: ['a1', 'a2'],
    parents: [master(), master('p2')],
    spreads: [
      makeSpread({
        id: 's1',
        parentId: 'p1',
        templateId: 'not-a-template',
        frames: [makeFrame({ id: 'own', z: 3 })],
      }),
    ],
    ...extra,
  })
  return applyBookOp(book, {
    type: 'overrideParentFrame',
    spreadId: 's1',
    parentFrameId: 'logo',
    id: 'copy',
  })
}

function spreadOf(book: Book): Spread {
  const spread = book.spreads[0]
  if (spread === undefined) {
    throw new Error('no spread')
  }
  return spread
}

function copyOf(book: Book): (Frame & { overridesId: string }) | undefined {
  return spreadOf(book).parentOverrides?.frames?.[0]
}

const at = { spreadId: 's1', frameId: 'copy' }

describe('frame ops on a local copy', () => {
  const cases: [string, BookOp, (copy: Frame) => unknown, unknown][] = [
    [
      'moveFrame',
      { type: 'moveFrame', ...at, dx: 5, dy: 0 },
      (f) => f.rect.x,
      15,
    ],
    [
      'moveFrames',
      { type: 'moveFrames', spreadId: 's1', frameIds: ['copy'], dx: 0, dy: 4 },
      (f) => f.rect.y,
      14,
    ],
    [
      'resizeFrame',
      {
        type: 'resizeFrame',
        ...at,
        rect: { x: 0, y: 0, width: 50, height: 60 },
      },
      (f) => f.rect.width,
      50,
    ],
    [
      'setFrameRect',
      {
        type: 'setFrameRect',
        ...at,
        rect: { x: 1, y: 2, width: 30, height: 40 },
      },
      (f) => f.rect.height,
      40,
    ],
    [
      'rotateFrame',
      { type: 'rotateFrame', ...at, rotationDeg: 90 },
      (f) => f.rotationDeg,
      90,
    ],
    [
      'replace',
      { type: 'replace', ...at, assetId: 'a2' },
      (f) => f.assetId,
      'a2',
    ],
    [
      'setFrameAdjust',
      { type: 'setFrameAdjust', ...at, patch: { brightness: 10 } },
      (f) => f.adjust?.brightness,
      10,
    ],
    [
      'fillSpread',
      { type: 'fillSpread', ...at, assetIds: ['a2', 'a1'] },
      (f) => f.assetId,
      'a2',
    ],
    [
      'setCrop',
      { type: 'setCrop', ...at, crop: { zoom: 2, center: { x: 0.5, y: 0.5 } } },
      (f) => f.crop?.zoom,
      2,
    ],
    ['setFit', { type: 'setFit', ...at, fit: 'fit' }, (f) => f.fit, 'fit'],
    [
      'setFrameCaption',
      { type: 'setFrameCaption', ...at, caption: 'Hi' },
      (f) => f.caption,
      'Hi',
    ],
    [
      'setFrameLocked',
      { type: 'setFrameLocked', ...at, locked: true },
      (f) => f.locked,
      true,
    ],
    [
      'setFramesLocked',
      {
        type: 'setFramesLocked',
        spreadId: 's1',
        frameIds: ['copy'],
        locked: true,
      },
      (f) => f.locked,
      true,
    ],
  ]

  it.each(cases)(
    '%s edits the copy, keeps overridesId, the template and the parent',
    (_, op, read, value) => {
      const book = overriddenBook()
      const next = applyBookOp(book, op)
      const copy = copyOf(next)
      expect(copy === undefined ? undefined : read(copy)).toEqual(value)
      expect(copy?.overridesId).toBe('logo')
      expect(spreadOf(next).templateId).toBe('not-a-template')
      expect(next.parents).toBe(book.parents)
    },
  )

  it('fill puts the first photo in the copy and the rest in empty own frames', () => {
    const next = applyBookOp(overriddenBook(), {
      type: 'fillSpread',
      ...at,
      assetIds: ['a1', 'a2'],
    })
    expect(copyOf(next)?.assetId).toBe('a1')
    expect(spreadOf(next).frames[0]?.assetId).toBe('a2')
  })

  it('unplace, place, swap and reset crop reach the copy', () => {
    const empty = applyBookOp(overriddenBook(), { type: 'unplace', ...at })
    expect(copyOf(empty)?.assetId).toBeUndefined()
    const placed = applyBookOp(empty, { type: 'place', ...at, assetId: 'a1' })
    expect(copyOf(placed)?.assetId).toBe('a1')
    const swapped = applyBookOp(placed, {
      type: 'swap',
      spreadIdA: 's1',
      frameIdA: 'copy',
      spreadIdB: 's1',
      frameIdB: 'own',
    })
    expect(copyOf(swapped)?.assetId).toBeUndefined()
    expect(spreadOf(swapped).frames[0]?.assetId).toBe('a1')
    const cropped = applyBookOp(placed, {
      type: 'setCrop',
      ...at,
      crop: { zoom: 3, center: { x: 0.2, y: 0.5 } },
    })
    expect(
      copyOf(applyBookOp(cropped, { type: 'resetCrop', ...at }))?.crop?.zoom,
    ).toBe(1)
  })

  it('a locked copy does not move; z-order and delete stay own-only', () => {
    const locked = applyBookOp(overriddenBook(), {
      type: 'setFrameLocked',
      ...at,
      locked: true,
    })
    expect(
      applyBookOp(locked, { type: 'moveFrame', ...at, dx: 3, dy: 3 }),
    ).toBe(locked)
    const book = overriddenBook()
    expect(
      applyBookOp(book, { type: 'reorderFrame', ...at, move: 'front' }),
    ).toBe(book)
    expect(
      applyBookOp(book, {
        type: 'removeFrames',
        spreadId: 's1',
        frameIds: ['copy'],
      }),
    ).toBe(book)
  })

  it('a copy photo counts as a placement and leaves with the gallery', () => {
    const placed = applyBookOp(overriddenBook(), {
      type: 'place',
      ...at,
      assetId: 'a1',
    })
    expect(placementCountByAsset(placed).get('a1')).toBe(1)
    const removed = applyBookOp(placed, {
      type: 'removeFromGallery',
      assetId: 'a1',
    })
    expect(copyOf(removed)?.assetId).toBeUndefined()
    expect(copyOf(removed)?.overridesId).toBe('logo')
  })
})

describe('override ops guards', () => {
  it('a taken id, an unknown item or a parent as spread leave the book', () => {
    const book = overriddenBook()
    const tries: BookOp[] = [
      { type: 'overrideParentFrame', spreadId: 's1', parentFrameId: 'logo' },
      { type: 'overrideParentFrame', spreadId: 's1', parentFrameId: 'gone' },
      { type: 'overrideParentFrame', spreadId: 'p1', parentFrameId: 'logo' },
      {
        type: 'overrideParentGuide',
        spreadId: 's1',
        parentGuideId: 'pg',
        id: 'g-own',
      },
      { type: 'hideParentItem', spreadId: 's1', parentItemId: 'gone' },
      { type: 'resetParentItem', spreadId: 's1', parentItemId: 'pg' },
    ]
    const withGuide: Book = {
      ...book,
      spreads: [
        {
          ...spreadOf(book),
          guides: [{ id: 'g-own', orientation: 'vertical', offsetMm: 1 }],
        },
      ],
    }
    for (const op of tries) {
      expect(applyBookOp(withGuide, op)).toBe(withGuide)
    }
  })

  it('hiding on a spread without a parent leaves the book', () => {
    const book = makeBook({
      parents: [master()],
      spreads: [makeSpread({ id: 's1', frames: [makeFrame({ id: 'own' })] })],
    })

    const next = applyBookOp(book, {
      type: 'hideParentItem',
      spreadId: 's1',
      parentItemId: 'logo',
    })

    expect(next).toBe(book)
  })

  it('default copy ids skip own and parent ids', () => {
    const book = makeBook({
      parents: [
        { ...master(), frames: [logo, makeFrame({ id: 'copy-1', z: 1 })] },
      ],
      spreads: [
        makeSpread({
          id: 's1',
          parentId: 'p1',
          frames: [makeFrame({ id: 'copy-2' })],
        }),
      ],
    })
    const next = applyBookOp(book, {
      type: 'overrideParentFrame',
      spreadId: 's1',
      parentFrameId: 'logo',
    })
    expect(copyOf(next)?.id).toBe('copy-3')
    const guide = applyBookOp(next, {
      type: 'overrideParentGuide',
      spreadId: 's1',
      parentGuideId: 'pg',
    })
    expect(spreadOf(guide).parentOverrides?.guides?.[0]).toMatchObject({
      id: 'copy-1',
      overridesId: 'pg',
    })
  })
})

describe('keeping the work on a parent change', () => {
  it('deleting the parent and a new book default keep copies as own frames', () => {
    const viaDefault = overriddenBook({ defaultParentId: 'p1' })
    const stored: Book = {
      ...viaDefault,
      spreads: [{ ...spreadOf(viaDefault), parentId: 'p1' }],
    }
    for (const next of [
      applyBookOp(stored, { type: 'removeParent', parentId: 'p1' }),
      applyBookOp(
        { ...stored, spreads: [{ ...spreadOf(stored), parentId: undefined }] },
        { type: 'setDefaultParent', parentId: 'p2' },
      ),
    ]) {
      expect(spreadOf(next).parentOverrides).toBeUndefined()
      expect(spreadOf(next).frames.map((frame) => frame.id)).toEqual([
        'copy',
        'own',
      ])
      expect(spreadOf(next).frames[0]?.z).toBe(2)
    }
  })

  it('a default change the spread does not follow keeps its overrides', () => {
    const book = overriddenBook({ defaultParentId: 'p2' })
    const next = applyBookOp(book, { type: 'setDefaultParent', parentId: null })
    expect(next.spreads).toBe(book.spreads)
  })

  it('a copy id taken by an own frame is renamed', () => {
    const book = overriddenBook()
    const clash: Book = {
      ...book,
      spreads: [
        {
          ...spreadOf(book),
          frames: [...spreadOf(book).frames, makeFrame({ id: 'copy', z: 5 })],
        },
      ],
    }
    const next = applyBookOp(clash, {
      type: 'setSpreadParent',
      spreadId: 's1',
      parentId: 'p2',
    })
    expect(spreadOf(next).frames.map((frame) => frame.id)).toEqual([
      'copy-1',
      'own',
      'copy',
    ])
  })
})
