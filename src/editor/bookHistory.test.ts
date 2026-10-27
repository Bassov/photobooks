import { describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  canRedo,
  canUndo,
  coalesceKey,
  EMPTY_HISTORY,
  isUndoableOp,
  recordStep,
  redoStep,
  snapshotOf,
  undoStep,
} from './bookHistory'

const snap = (id: string) =>
  snapshotOf(makeBook({ spreads: [makeSpread({ id })] }))

describe('bookHistory', () => {
  it('records, undoes and redoes as a pointer move', () => {
    const a = snap('a')
    const b = snap('b')
    const h = recordStep(EMPTY_HISTORY, a, undefined)
    expect(canUndo(h)).toBe(true)
    const undone = undoStep(h, b)
    expect(undone?.snapshot).toBe(a)
    expect(canRedo(undone?.history ?? EMPTY_HISTORY)).toBe(true)
    const redone = redoStep(undone?.history ?? EMPTY_HISTORY, a)
    expect(redone?.snapshot).toBe(b)
    expect(canUndo(redone?.history ?? EMPTY_HISTORY)).toBe(true)
  })

  it('returns null at the ends', () => {
    expect(undoStep(EMPTY_HISTORY, snap('a'))).toBeNull()
    expect(redoStep(EMPTY_HISTORY, snap('a'))).toBeNull()
  })

  it('drops redo steps on a new record', () => {
    const h = recordStep(EMPTY_HISTORY, snap('a'), undefined)
    const undone = undoStep(h, snap('b'))?.history ?? EMPTY_HISTORY
    expect(recordStep(undone, snap('c'), undefined).future).toHaveLength(0)
  })

  it('coalesces consecutive equal keys into one step', () => {
    const first = snap('a')
    let h = recordStep(EMPTY_HISTORY, first, 'k')
    h = recordStep(h, snap('b'), 'k')
    expect(h.past).toEqual([first])
    h = recordStep(h, snap('c'), undefined)
    expect(h.past).toHaveLength(2)
  })

  it('evicts the oldest step over the limit', () => {
    let h = EMPTY_HISTORY
    for (const id of ['a', 'b', 'c']) {
      h = recordStep(h, snap(id), undefined, 2)
    }
    expect(h.past.map((s) => s.spreads[0]?.id)).toEqual(['b', 'c'])
  })

  it('classifies ops', () => {
    expect(isUndoableOp({ type: 'addToGallery', assetIds: [] })).toBe(false)
    expect(isUndoableOp({ type: 'removeFromGallery', assetId: 'x' })).toBe(
      false,
    )
    expect(isUndoableOp({ type: 'removeSpread', spreadId: 's' })).toBe(true)
    expect(coalesceKey({ type: 'setTitle', title: 'x' })).toBe('setTitle')
    expect(coalesceKey({ type: 'removeSpread', spreadId: 's' })).toBeUndefined()
  })
})
