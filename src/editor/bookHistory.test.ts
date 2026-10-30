import { describe, expect, it } from 'vitest'
import type { BookOp } from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  canRedo,
  canUndo,
  coalesceKey,
  EMPTY_HISTORY,
  isUndoableOp,
  recordStep,
  opLabel,
  undoLabel,
  redoLabel,
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
    const h = {
      ...EMPTY_HISTORY,
      future: [c, b],
      futureLabels: ['Edit', 'Edit'],
    }
    const first = redoStep(h, a)
    expect(first?.snapshot).toBe(b)
    expect(first?.history.future).toEqual([c])
    expect(first?.history.past).toEqual([a])
  })

  it('starts empty', () => {
    expect(EMPTY_HISTORY).toEqual({
      past: [],
      future: [],
      key: undefined,
      pastLabels: [],
      futureLabels: [],
    })
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
    const rotate = { type: 'rotateFrame', spreadId: 's', frameId: 'f' } as const
    expect(coalesceKey({ ...rotate, rotationDeg: 5 })).toBeUndefined()
    expect(coalesceKey({ ...rotate, rotationDeg: 5, live: true })).toBe(
      'rotate:s:f',
    )
  })
})

describe('step labels', () => {
  it('names ops and falls back to Edit', () => {
    expect(opLabel({ type: 'setTitle', title: 'x' })).toBe('Rename book')
    expect(undoLabel(EMPTY_HISTORY)).toBeNull()
    expect(redoLabel(EMPTY_HISTORY)).toBeNull()
  })

  it('moves the label between undo and redo', () => {
    const h = recordStep(EMPTY_HISTORY, snap('a'), undefined, undefined, 'Crop')
    expect(undoLabel(h)).toBe('Crop')
    const undone = undoStep(h, snap('b'))?.history ?? EMPTY_HISTORY
    expect(undoLabel(undone)).toBeNull()
    expect(redoLabel(undone)).toBe('Crop')
    const redone = redoStep(undone, snap('a'))?.history ?? EMPTY_HISTORY
    expect(undoLabel(redone)).toBe('Crop')
  })
})

describe('step label bookkeeping', () => {
  const labelled = (names: string[], limit?: number) =>
    names.reduce(
      (h, name, i) =>
        recordStep(h, snap(`s${String(i)}`), undefined, limit, name),
      EMPTY_HISTORY,
    )

  it('maps every op kind to its label', () => {
    const expected: Record<string, string> = {
      place: 'Place photo',
      replace: 'Replace photo',
      unplace: 'Remove photo',
      fillSpread: 'Fill spread',
      insertSpreadWithAssets: 'Insert spread',
      setCrop: 'Crop',
      resetCrop: 'Reset crop',
      setFit: 'Change fit',
      swap: 'Swap photos',
      applyTemplate: 'Apply layout',
      addSpread: 'Add spread',
      removeSpread: 'Delete spread',
      duplicateSpread: 'Duplicate spread',
      moveSpread: 'Move spread',
      addFrame: 'Add frame',
      removeFrames: 'Delete frame',
      setFrameRect: 'Edit frame',
      moveFrame: 'Move frame',
      resizeFrame: 'Resize frame',
      rotateFrame: 'Rotate frame',
      reorderFrame: 'Reorder frame',
      setFrameLocked: 'Lock frame',
      alignFrames: 'Align frames',
      distributeFrames: 'Distribute frames',
      setTitle: 'Rename book',
      setBookGrid: 'Change grid',
      setSpreadGrid: 'Change grid',
      resetSpreadGrid: 'Reset grid',
    }
    for (const [type, text] of Object.entries(expected)) {
      expect(opLabel({ type } as unknown as BookOp)).toBe(text)
    }
    expect(opLabel({ type: 'nope' } as unknown as BookOp)).toBe('Edit')
  })

  it('keeps the newest labels when over the limit', () => {
    const h = labelled(['a', 'b', 'c', 'd', 'e'], 3)
    expect(h.past).toHaveLength(3)
    expect(h.pastLabels).toEqual(['c', 'd', 'e'])
  })

  it('a new record after undo clears redo labels', () => {
    const h = labelled(['a', 'b'])
    const undone = undoStep(h, snap('x'))?.history ?? EMPTY_HISTORY
    expect(undone.futureLabels).toEqual(['b'])
    const next = recordStep(undone, snap('y'), undefined, undefined, 'c')
    expect(next.futureLabels).toEqual([])
    expect(redoLabel(next)).toBeNull()
    expect(next.pastLabels).toEqual(['a', 'c'])
  })

  it('undo leaves the remaining past labels and exposes the previous one', () => {
    const h = labelled(['a', 'b', 'c'])
    const undone = undoStep(h, snap('x'))?.history ?? EMPTY_HISTORY
    expect(undone.pastLabels).toEqual(['a', 'b'])
    expect(undone.futureLabels).toEqual(['c'])
    expect(undoLabel(undone)).toBe('b')
    expect(redoLabel(undone)).toBe('c')
  })

  it('redo leaves the remaining future labels and exposes the next one', () => {
    const h = labelled(['a', 'b', 'c', 'd'])
    const u1 = undoStep(h, snap('x'))?.history ?? EMPTY_HISTORY
    const u2 = undoStep(u1, snap('y'))?.history ?? EMPTY_HISTORY
    const u3 = undoStep(u2, snap('w'))?.history ?? EMPTY_HISTORY
    expect(u3.futureLabels).toEqual(['d', 'c', 'b'])
    const redone = redoStep(u3, snap('z'))?.history ?? EMPTY_HISTORY
    expect(redone.pastLabels).toEqual(['a', 'b'])
    expect(redone.futureLabels).toEqual(['d', 'c'])
    expect(undoLabel(redone)).toBe('b')
    expect(redoLabel(redone)).toBe('c')
  })
})
