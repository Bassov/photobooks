import { fc, test } from '@fast-check/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { applyBookOp, layerOf, type Book, type ZMove } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  arrangeOp,
  arrangeShortcut,
  frameLocked,
  installArrangeKeys,
  lockOp,
  runArrangeAction,
  zMovesFor,
  zOrderOp,
} from './frameArrange'
import { resetFrameSelection, setFrameSource } from './frameSelection'

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
