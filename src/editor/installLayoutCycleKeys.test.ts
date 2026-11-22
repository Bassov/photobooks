import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  installLayoutCycleKeys,
  layoutCycleKeyDir,
} from './installLayoutCycleKeys'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'
import {
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'

const key = (code: string, mods: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', {
    code,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
    ...mods,
  })

const template = () => getBookStoreSnapshot().book.spreads[1]?.templateId

function seed(count: number): void {
  resetBookStore({
    book: makeBook({
      spreads: ['s0', 's1', 's2'].map((id, index) =>
        makeSpread({
          id,
          frames: Array.from({ length: index === 1 ? count : 1 }, (_, i) =>
            makeFrame({ id: `${id}-f${String(i)}`, z: i }),
          ),
        }),
      ),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('layoutCycleKeyDir', () => {
  const plain = {
    code: 'BracketRight',
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  }

  it('maps Shift + physical brackets only', () => {
    expect(layoutCycleKeyDir(plain)).toBe(1)
    expect(layoutCycleKeyDir({ ...plain, code: 'BracketLeft' })).toBe(-1)
    expect(layoutCycleKeyDir({ ...plain, code: 'KeyB' })).toBeNull()
    expect(layoutCycleKeyDir({ ...plain, shiftKey: false })).toBeNull()
    expect(layoutCycleKeyDir({ ...plain, ctrlKey: true })).toBeNull()
    expect(layoutCycleKeyDir({ ...plain, metaKey: true })).toBeNull()
    expect(layoutCycleKeyDir({ ...plain, altKey: true })).toBeNull()
  })
})

describe('installLayoutCycleKeys', () => {
  let dispose: () => void = () => undefined

  beforeEach(() => {
    seed(2)
    setActiveSpreadId('s1')
    dispose = installLayoutCycleKeys()
  })

  afterEach(() => {
    dispose()
    document.body.replaceChildren()
    resetBookStore()
    resetActiveSpreadIdForTests()
    resetLeftPanelTabForTests()
  })

  it('cycles the active spread and prevents the default only when acting', () => {
    const next = key('BracketRight')
    window.dispatchEvent(next)
    expect(template()).toBe('one-per-page')
    expect(next.defaultPrevented).toBe(true)
    window.dispatchEvent(key('BracketLeft'))
    expect(template()).toBe('offset-pair')
    const bare = key('BracketRight', { shiftKey: false })
    window.dispatchEvent(bare)
    expect(template()).toBe('offset-pair')
    expect(bare.defaultPrevented).toBe(false)
  })

  it('ignores typing targets, Masters, modal layers and no active spread', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(key('BracketRight'))
    expect(template()).toBeUndefined()
    setLeftPanelTab('masters')
    window.dispatchEvent(key('BracketRight'))
    expect(template()).toBeUndefined()
    setLeftPanelTab('pages')
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.append(dialog)
    window.dispatchEvent(key('BracketRight'))
    expect(template()).toBeUndefined()
    dialog.remove()
    resetActiveSpreadIdForTests()
    window.dispatchEvent(key('BracketRight'))
    expect(template()).toBeUndefined()
  })

  it('leaves the default when the spread has no cycle', () => {
    seed(5)
    const event = key('BracketRight')
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(template()).toBeUndefined()
  })
})
