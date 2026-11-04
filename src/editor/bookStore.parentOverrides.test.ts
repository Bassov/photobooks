import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BookOp } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  getSpreadPaintSnapshot,
  resetBookStore,
  subscribeSpread,
  undoBook,
} from './bookStore'

/** Spreads s1 / s2 on Master A (logo + band + one guide). */
function loadBook(): void {
  resetBookStore({
    book: makeBook({
      parents: [
        {
          id: 'pA',
          name: 'Master A',
          frames: [
            makeFrame({ id: 'logo', z: 0 }),
            makeFrame({ id: 'band', z: 1 }),
          ],
          guides: [{ id: 'pg', orientation: 'vertical', offsetMm: 20 }],
        },
        { id: 'pB', name: 'Master B', frames: [], guides: [] },
      ],
      defaultParentId: 'pA',
      spreads: [
        makeSpread({ id: 's1', frames: [makeFrame({ id: 'own', z: 2 })] }),
        makeSpread({ id: 's2' }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Repaint counts per spread id while `run` dispatches. */
function repaints(run: () => void): Record<string, number> {
  const counts: Record<string, number> = { s1: 0, s2: 0, pA: 0 }
  const stops = Object.keys(counts).map((id) =>
    subscribeSpread(id, () => {
      counts[id] = (counts[id] ?? 0) + 1
    }),
  )
  run()
  for (const stop of stops) {
    stop()
  }
  return counts
}

const overrideLogo: BookOp = {
  type: 'overrideParentFrame',
  spreadId: 's1',
  parentFrameId: 'logo',
  id: 'logo-copy',
}

describe('bookStore parent overrides', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('dispatches every override op as one labelled step', () => {
    loadBook()
    const steps: [BookOp, string][] = [
      [overrideLogo, 'Override parent item'],
      [
        { type: 'overrideParentGuide', spreadId: 's1', parentGuideId: 'pg' },
        'Override parent guide',
      ],
      [
        { type: 'hideParentItem', spreadId: 's1', parentItemId: 'band' },
        'Hide parent item',
      ],
      [
        { type: 'resetParentItem', spreadId: 's1', parentItemId: 'band' },
        'Reset to parent',
      ],
      [
        { type: 'resetSpreadToParent', spreadId: 's1' },
        'Reset spread to parent',
      ],
    ]
    const books = [getBookStoreSnapshot().book]
    for (const [op, label] of steps) {
      dispatchBookOp(op)
      expect(getHistorySnapshot().undoLabel).toBe(label)
      books.push(getBookStoreSnapshot().book)
    }
    expect(
      getBookStoreSnapshot().book.spreads[0]?.parentOverrides,
    ).toBeUndefined()
    for (const book of books.slice(0, -1).reverse()) {
      undoBook()
      expect(getBookStoreSnapshot().book.spreads).toBe(book.spreads)
    }
  })

  it('an override, hide or reset repaints only its spread', () => {
    loadBook()
    expect(
      repaints(() => {
        dispatchBookOp(overrideLogo)
      }),
    ).toEqual({
      s1: 1,
      s2: 0,
      pA: 0,
    })
    const copy = getSpreadPaintSnapshot('s1')?.resolved.items.map(
      (item) => item.frameId,
    )
    expect(copy).toEqual(['band', 'logo-copy', 'own'])
    expect(
      repaints(() => {
        dispatchBookOp({
          type: 'hideParentItem',
          spreadId: 's1',
          parentItemId: 'band',
        })
      }),
    ).toEqual({ s1: 1, s2: 0, pA: 0 })
    expect(
      repaints(() => {
        dispatchBookOp({ type: 'resetSpreadToParent', spreadId: 's1' })
      }),
    ).toEqual({ s1: 1, s2: 0, pA: 0 })
  })

  it('a parent edit skips the spreads that override or hide the edited item', () => {
    loadBook()
    dispatchBookOp(overrideLogo)
    const moveLogo = () => {
      dispatchBookOp({
        type: 'moveFrame',
        spreadId: 'pA',
        frameId: 'logo',
        dx: 5,
        dy: 0,
      })
    }
    expect(repaints(moveLogo)).toEqual({ s1: 0, s2: 1, pA: 1 })
    const copyRect =
      getBookStoreSnapshot().book.spreads[0]?.parentOverrides?.frames?.[0]?.rect
    expect(copyRect?.x).toBe(10)
    // An item the spread still inherits repaints it.
    expect(
      repaints(() => {
        dispatchBookOp({
          type: 'moveFrame',
          spreadId: 'pA',
          frameId: 'band',
          dx: 5,
          dy: 0,
        })
      }),
    ).toEqual({ s1: 1, s2: 1, pA: 1 })
  })

  it('a master switch keeps the copy as an own frame in the same step', () => {
    loadBook()
    dispatchBookOp(overrideLogo)
    const overridden = getBookStoreSnapshot().book
    const repaint = vi.fn()
    const stop = subscribeSpread('s1', repaint)
    dispatchBookOp({ type: 'setSpreadParent', spreadId: 's1', parentId: 'pB' })
    stop()
    const spread = getBookStoreSnapshot().book.spreads[0]
    expect(spread?.frames.map((frame) => frame.id)).toEqual([
      'logo-copy',
      'own',
    ])
    expect(spread?.parentOverrides).toBeUndefined()
    expect(repaint).toHaveBeenCalledTimes(1)
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toBe(overridden.spreads)
  })
})
