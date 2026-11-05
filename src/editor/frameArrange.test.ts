import { fc, test } from '@fast-check/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyBookOp,
  layerOf,
  parentAsSpread,
  type Book,
  type ZMove,
} from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  arrangeOp,
  arrangeShortcut,
  deleteFramesOp,
  frameLocked,
  installArrangeKeys,
  lockOp,
  runArrangeAction,
  runSetArrangeAction,
  setArrangeOp,
  setLayerRange,
  setZMovesFor,
  zMovesFor,
  zOrderOp,
} from './frameArrange'
import {
  resetFrameSelection,
  setFrameSelection,
  setFrameSource,
} from './frameSelection'

const KEY = {
  code: '',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
}

function stackBook(count: number, lockedId?: string): Book {
  return makeBook({
    spreads: [
      makeSpread({
        id: 's',
        frames: Array.from({ length: count }, (_, at) =>
          makeFrame({
            id: `f${String(at)}`,
            z: at + 1,
            ...(`f${String(at)}` === lockedId ? { locked: true } : {}),
          }),
        ),
      }),
    ],
  })
}

const at = (frameId: string) => ({ spreadId: 's', frameId })

/** The same stack on parent spread `m` (Masters canvas), no book spreads. */
function parentBook(count: number, lockedId?: string): Book {
  const frames = stackBook(count, lockedId).spreads[0]?.frames ?? []
  return makeBook({
    parents: [{ id: 'm', name: 'Master A', frames, guides: [] }],
  })
}

const onParent = (frameId: string) => ({ spreadId: 'm', frameId })

describe('arrangeShortcut', () => {
  it.each([
    ['BracketRight', false, { kind: 'z', move: 'forward' }],
    ['BracketRight', true, { kind: 'z', move: 'front' }],
    ['BracketLeft', false, { kind: 'z', move: 'backward' }],
    ['BracketLeft', true, { kind: 'z', move: 'back' }],
    ['KeyL', true, { kind: 'lock' }],
    ['KeyL', false, null],
    ['KeyZ', false, null],
  ])('Ctrl or Cmd + %s (Shift %s)', (code, shiftKey, action) => {
    expect(arrangeShortcut({ ...KEY, code, shiftKey, ctrlKey: true })).toEqual(
      action,
    )
    expect(arrangeShortcut({ ...KEY, code, shiftKey, metaKey: true })).toEqual(
      action,
    )
  })

  test.prop([
    fc.constantFrom('BracketRight', 'BracketLeft', 'KeyL', 'KeyA'),
    fc.boolean(),
    fc.boolean(),
    fc.boolean(),
    fc.boolean(),
  ])(
    'acts only with Ctrl or Cmd and never with Alt',
    (code, ctrlKey, metaKey, shiftKey, altKey) => {
      const action = arrangeShortcut({
        code,
        ctrlKey,
        metaKey,
        shiftKey,
        altKey,
      })
      if (!(ctrlKey || metaKey) || altKey) {
        expect(action).toBeNull()
      }
    },
  )
})

describe('zMovesFor', () => {
  it('offers only moves that change the stack', () => {
    const book = stackBook(3)
    expect(zMovesFor(book, at('f0'))).toEqual(['front', 'forward'])
    expect(zMovesFor(book, at('f1'))).toEqual([
      'front',
      'forward',
      'backward',
      'back',
    ])
    expect(zMovesFor(book, at('f2'))).toEqual(['backward', 'back'])
    expect(zMovesFor(stackBook(1), at('f0'))).toEqual([])
    expect(zMovesFor(book, at('nope'))).toEqual([])
    expect(zMovesFor(book, { spreadId: 'nope', frameId: 'f0' })).toEqual([])
  })

  test.prop([
    fc
      .integer({ min: 1, max: 6 })
      .chain((count) =>
        fc.tuple(fc.constant(count), fc.integer({ min: 0, max: count - 1 })),
      ),
    fc.constantFrom<ZMove>('front', 'forward', 'backward', 'back'),
  ])(
    'an offered move changes the layer, a hidden one does not',
    (pick, move) => {
      const [count, index] = pick
      const book = stackBook(count)
      const target = at(`f${String(index)}`)
      const spreadBefore = book.spreads[0]
      const after = applyBookOp(book, zOrderOp(target, move))
      const spreadAfter = after.spreads[0]
      if (spreadBefore === undefined || spreadAfter === undefined) {
        throw new Error('expected a spread')
      }
      const moved =
        layerOf(spreadAfter, target.frameId)?.layer !==
        layerOf(spreadBefore, target.frameId)?.layer
      expect(zMovesFor(book, target).includes(move)).toBe(moved)
      expect(arrangeOp(book, target, { kind: 'z', move }) !== null).toBe(moved)
    },
  )
})

describe('arrangeOp and frameLocked', () => {
  it('toggles the lock and ignores an unknown frame', () => {
    expect(arrangeOp(stackBook(2), at('f1'), { kind: 'lock' })).toEqual(
      lockOp(at('f1'), true),
    )
    expect(arrangeOp(stackBook(2, 'f1'), at('f1'), { kind: 'lock' })).toEqual(
      lockOp(at('f1'), false),
    )
    expect(arrangeOp(stackBook(2), at('nope'), { kind: 'lock' })).toBeNull()
    expect(
      arrangeOp(stackBook(2), at('f0'), { kind: 'z', move: 'front' }),
    ).toEqual(zOrderOp(at('f0'), 'front'))
    expect(frameLocked(stackBook(2, 'f1'), at('f1'))).toBe(true)
    expect(frameLocked(stackBook(2, 'f1'), at('f0'))).toBe(false)
    expect(frameLocked(stackBook(2), at('nope'))).toBe(false)
  })

  it('finds parent-spread frames, so a locked one refuses a drop', () => {
    // galleryDrop refuses dragover and drop on a target frameLocked reports.
    expect(frameLocked(parentBook(2, 'f1'), onParent('f1'))).toBe(true)
    expect(frameLocked(parentBook(2, 'f1'), onParent('f0'))).toBe(false)
    expect(zMovesFor(parentBook(2), onParent('f0'))).toEqual([
      'front',
      'forward',
    ])
    expect(
      arrangeOp(parentBook(2, 'f1'), onParent('f1'), { kind: 'lock' }),
    ).toEqual(lockOp(onParent('f1'), false))
  })
})

function seed(book: Book) {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function press(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

const layer = (frameId: string) => {
  const spread = getBookStoreSnapshot().book.spreads[0]
  return spread === undefined ? null : layerOf(spread, frameId)?.layer
}

describe('installArrangeKeys', () => {
  afterEach(() => {
    resetFrameSelection()
    resetBookStore()
    document.body.replaceChildren()
  })

  it('restacks and locks the selected frame', () => {
    seed(stackBook(3))
    setFrameSource(at('f0'))
    const off = installArrangeKeys()

    const front = press({ code: 'BracketRight', ctrlKey: true, shiftKey: true })
    expect(front.defaultPrevented).toBe(true)
    expect(layer('f0')).toBe(3)
    press({ code: 'BracketLeft', metaKey: true })
    expect(layer('f0')).toBe(2)
    press({ code: 'BracketLeft', ctrlKey: true, shiftKey: true })
    expect(layer('f0')).toBe(1)
    press({ code: 'BracketRight', ctrlKey: true })
    expect(layer('f0')).toBe(2)
    press({ code: 'KeyL', ctrlKey: true, shiftKey: true })
    expect(frameLocked(getBookStoreSnapshot().book, at('f0'))).toBe(true)

    off()
    press({ code: 'KeyL', ctrlKey: true, shiftKey: true })
    expect(frameLocked(getBookStoreSnapshot().book, at('f0'))).toBe(true)
  })

  it('restacks and locks a selected parent-spread frame', () => {
    seed(parentBook(2))
    setFrameSource(onParent('f0'))
    const off = installArrangeKeys()
    const parentLayer = () => {
      const parent = getBookStoreSnapshot().book.parents?.[0]
      return parent === undefined
        ? null
        : layerOf(parentAsSpread(parent), 'f0')?.layer
    }

    const front = press({ code: 'BracketRight', ctrlKey: true, shiftKey: true })
    expect(front.defaultPrevented).toBe(true)
    expect(parentLayer()).toBe(2)
    press({ code: 'KeyL', ctrlKey: true, shiftKey: true })
    expect(frameLocked(getBookStoreSnapshot().book, onParent('f0'))).toBe(true)
    off()
  })

  it('leaves the key to the browser without a selected frame or in a text field', () => {
    seed(stackBook(2))
    const off = installArrangeKeys()
    const bare = press({ code: 'BracketRight', ctrlKey: true })
    expect(bare.defaultPrevented).toBe(false)

    setFrameSource(at('gone'))
    expect(
      press({ code: 'BracketRight', ctrlKey: true }).defaultPrevented,
    ).toBe(false)

    setFrameSource(at('f0'))
    const input = document.createElement('input')
    document.body.append(input)
    const typed = press({ code: 'BracketRight', ctrlKey: true }, input)
    expect(typed.defaultPrevented).toBe(false)
    expect(layer('f0')).toBe(1)

    expect(press({ code: 'KeyA', ctrlKey: true }).defaultPrevented).toBe(false)
    off()
  })

  it('runArrangeAction reports a move that changes nothing', () => {
    seed(stackBook(2))
    const before = getBookStoreSnapshot().book
    expect(runArrangeAction(at('f1'), { kind: 'z', move: 'front' })).toBe(false)
    expect(getBookStoreSnapshot().book).toBe(before)
    expect(runArrangeAction(at('f1'), { kind: 'z', move: 'back' })).toBe(true)
    expect(layer('f1')).toBe(1)
  })
})

const set = (...frameIds: string[]) => ({ spreadId: 's', frameIds })

describe('set actions (2 or more selected)', () => {
  afterEach(() => {
    resetFrameSelection()
    resetBookStore()
  })

  it('setZMovesFor lists the moves that change the stack of the set', () => {
    const book = stackBook(4)
    expect(setZMovesFor(book, set('f0', 'f1'))).toEqual(['front', 'forward'])
    expect(setZMovesFor(book, set('f0', 'f3'))).toEqual([
      'front',
      'forward',
      'backward',
      'back',
    ])
    expect(setZMovesFor(book, set('f2', 'f3'))).toEqual(['backward', 'back'])
    expect(setZMovesFor(book, set('nope', 'gone'))).toEqual([])
  })

  it('setArrangeOp: lock all when any is unlocked, else unlock all; null for a no-op', () => {
    expect(
      setArrangeOp(stackBook(3, 'f1'), set('f0', 'f1'), { kind: 'lock' }),
    ).toEqual({
      type: 'setFramesLocked',
      spreadId: 's',
      frameIds: ['f0', 'f1'],
      locked: true,
    })
    const allLocked = applyBookOp(stackBook(3, 'f1'), {
      type: 'setFramesLocked',
      spreadId: 's',
      frameIds: ['f0', 'f1'],
      locked: true,
    })
    expect(
      setArrangeOp(allLocked, set('f0', 'f1', 'gone'), { kind: 'lock' }),
    ).toEqual({
      type: 'setFramesLocked',
      spreadId: 's',
      frameIds: ['f0', 'f1'],
      locked: false,
    })
    expect(
      setArrangeOp(stackBook(3), set('gone', 'nope'), { kind: 'lock' }),
    ).toBeNull()
    expect(
      setArrangeOp(
        stackBook(3),
        { spreadId: 'x', frameIds: ['f0', 'f1'] },
        { kind: 'lock' },
      ),
    ).toBeNull()
    expect(
      setArrangeOp(stackBook(3), set('f1', 'f2'), { kind: 'z', move: 'front' }),
    ).toBeNull()
    expect(
      setArrangeOp(stackBook(3), set('f1', 'f2'), { kind: 'z', move: 'back' }),
    ).toEqual({
      type: 'reorderFrames',
      spreadId: 's',
      frameIds: ['f1', 'f2'],
      move: 'back',
    })
  })

  it('setLayerRange spans the lowest to the highest selected layer', () => {
    expect(setLayerRange(stackBook(4), set('f3', 'f1'))).toEqual({
      first: 2,
      last: 4,
      count: 4,
    })
    expect(setLayerRange(stackBook(4), set('gone'))).toBeNull()
    expect(
      setLayerRange(stackBook(4), { spreadId: 'x', frameIds: ['f0'] }),
    ).toBeNull()
  })

  it('shortcuts act on the whole set in one step each', () => {
    seed(stackBook(4))
    setFrameSelection(set('f0', 'f1'))
    const off = installArrangeKeys()

    const front = press({ code: 'BracketRight', ctrlKey: true, shiftKey: true })
    expect(front.defaultPrevented).toBe(true)
    expect([layer('f0'), layer('f1')]).toEqual([3, 4])
    press({ code: 'BracketLeft', ctrlKey: true })
    expect([layer('f0'), layer('f1')]).toEqual([2, 3])
    press({ code: 'KeyL', ctrlKey: true, shiftKey: true })
    const book = getBookStoreSnapshot().book
    expect(frameLocked(book, at('f0'))).toBe(true)
    expect(frameLocked(book, at('f1'))).toBe(true)
    expect(frameLocked(book, at('f2'))).toBe(false)
    press({ code: 'KeyL', ctrlKey: true, shiftKey: true })
    expect(frameLocked(getBookStoreSnapshot().book, at('f0'))).toBe(false)
    off()
  })

  it('leaves the key to the browser when the selected frames are gone', () => {
    seed(stackBook(2))
    setFrameSelection(set('gone', 'nope'))
    const off = installArrangeKeys()
    expect(
      press({ code: 'BracketRight', ctrlKey: true }).defaultPrevented,
    ).toBe(false)
    off()
  })

  it('runSetArrangeAction reports a move that changes nothing', () => {
    seed(stackBook(3))
    const before = getBookStoreSnapshot().book
    expect(
      runSetArrangeAction(set('f1', 'f2'), { kind: 'z', move: 'forward' }),
    ).toBe(false)
    expect(getBookStoreSnapshot().book).toBe(before)
    expect(
      runSetArrangeAction(set('f1', 'f2'), { kind: 'z', move: 'backward' }),
    ).toBe(true)
    expect([layer('f0'), layer('f1'), layer('f2')]).toEqual([3, 1, 2])
  })
})

describe('arrange on a local copy of a parent item', () => {
  /** Spread s1 on Master A, own frames f0 / f1 and copy `copy-1` of the logo. */
  function copyBook(): Book {
    return applyBookOp(
      makeBook({
        parents: [
          {
            id: 'p1',
            name: 'Master A',
            frames: [makeFrame({ id: 'logo', z: 5 })],
            guides: [],
          },
        ],
        spreads: [
          makeSpread({
            id: 's1',
            parentId: 'p1',
            frames: [
              makeFrame({ id: 'f0', z: 1 }),
              makeFrame({ id: 'f1', z: 2 }),
            ],
          }),
        ],
      }),
      {
        type: 'overrideParentFrame',
        spreadId: 's1',
        parentFrameId: 'logo',
        id: 'copy-1',
      },
    )
  }
  const copy = { spreadId: 's1', frameId: 'copy-1' }

  it('locks a copy but offers it no z-order move', () => {
    const book = copyBook()
    expect(zMovesFor(book, copy)).toEqual([])
    expect(arrangeOp(book, copy, { kind: 'z', move: 'front' })).toBeNull()
    expect(arrangeOp(book, copy, { kind: 'lock' })).toEqual(lockOp(copy, true))
    const locked = applyBookOp(book, lockOp(copy, true))
    expect(frameLocked(locked, copy)).toBe(true)
  })

  it('locks a set with a copy; its z rows move the own frames only', () => {
    const book = copyBook()
    const mixed = { spreadId: 's1', frameIds: ['copy-1', 'f0'] }
    expect(setArrangeOp(book, mixed, { kind: 'lock' })).toMatchObject({
      frameIds: ['f0', 'copy-1'],
      locked: true,
    })
    expect(
      setZMovesFor(book, { spreadId: 's1', frameIds: ['copy-1'] }),
    ).toEqual([])
    expect(setZMovesFor(book, mixed)).toEqual(['front', 'forward'])
  })

  it('deletes a lone copy as hiding its parent item, anything else as removeFrames', () => {
    const book = copyBook()
    expect(deleteFramesOp(book, 's1', ['copy-1'])).toEqual({
      type: 'hideParentItem',
      spreadId: 's1',
      parentItemId: 'logo',
    })
    expect(deleteFramesOp(book, 's1', ['f0'])).toEqual({
      type: 'removeFrames',
      spreadId: 's1',
      frameIds: ['f0'],
    })
    expect(deleteFramesOp(book, 's1', ['copy-1', 'f0'])).toEqual({
      type: 'removeFrames',
      spreadId: 's1',
      frameIds: ['copy-1', 'f0'],
    })
  })
})
