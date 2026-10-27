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

  it('does not coalesce without a key, on first entry, or with redo steps', () => {
    const a = snap('a')
    let h = recordStep(EMPTY_HISTORY, a, undefined)
    h = recordStep(h, snap('b'), undefined)
    expect(h.past).toHaveLength(2)

    const firstKeyed = recordStep({ ...EMPTY_HISTORY, key: 'k' }, a, 'k')
    expect(firstKeyed.past).toEqual([a])

    const keyed = recordStep(EMPTY_HISTORY, a, 'k')
    const withFuture = {
      ...keyed,
      future: [snap('z')],
    }
    const next = recordStep(withFuture, snap('b'), 'k')
    expect(next.past).toHaveLength(2)
    expect(next.future).toEqual([])
  })

  it('redo walks one step at a time', () => {
    const [a, b, c] = [snap('a'), snap('b'), snap('c')]
    const h = { past: [], future: [c, b], key: undefined }
    const first = redoStep(h, a)
    expect(first?.snapshot).toBe(b)
    expect(first?.history.future).toEqual([c])
    expect(first?.history.past).toEqual([a])
  })

  it('starts empty', () => {
    expect(EMPTY_HISTORY).toEqual({ past: [], future: [], key: undefined })
  })

  it('classifies ops', () => {
    expect(isUndoableOp({ type: 'addToGallery', assetIds: [] })).toBe(false)
    expect(isUndoableOp({ type: 'removeFromGallery', assetId: 'x' })).toBe(
      false,
    )
    expect(isUndoableOp({ type: 'removeSpread', spreadId: 's' })).toBe(true)
    expect(coalesceKey({ type: 'setTitle', title: 'x' })).toBe('setTitle')
    expect(coalesceKey({ type: 'removeSpread', spreadId: 's' })).toBeUndefined()
    expect(
      coalesceKey({ type: 'resetCrop', spreadId: 's', frameId: 'f' }),
    ).toBe('crop:s:f')
  })
})
