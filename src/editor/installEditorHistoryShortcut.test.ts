import { afterEach, describe, expect, it, vi } from 'vitest'
import * as store from './bookStore'
import { installEditorHistoryShortcut } from './installEditorHistoryShortcut'

function press(init: KeyboardEventInit, target: EventTarget = window) {
  const e = new KeyboardEvent('keydown', {
    cancelable: true,
    bubbles: true,
    ...init,
  })
  target.dispatchEvent(e)
  return e
}

describe('installEditorHistoryShortcut', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps chords to undo / redo and ignores text fields', () => {
    const undo = vi.spyOn(store, 'undoBook').mockReturnValue(undefined)
    const redo = vi.spyOn(store, 'redoBook').mockReturnValue(undefined)
    const dispose = installEditorHistoryShortcut()
    expect(press({ key: 'z', ctrlKey: true }).defaultPrevented).toBe(true)
    press({ key: 'z', metaKey: true })
    expect(undo).toHaveBeenCalledTimes(2)
    press({ key: 'Z', ctrlKey: true, shiftKey: true })
    press({ key: 'y', ctrlKey: true })
    expect(redo).toHaveBeenCalledTimes(2)
    expect(press({ key: 'y', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(redo).toHaveBeenCalledTimes(3)
    redo.mockClear()
    expect(
      press({ key: 'Z', ctrlKey: true, shiftKey: true }).defaultPrevented,
    ).toBe(true)
    redo.mockClear()
    press({ key: 'z' })
    const shiftY = press({ key: 'y', ctrlKey: true, shiftKey: true })
    const other = press({ key: 'a', ctrlKey: true })
    expect(shiftY.defaultPrevented).toBe(false)
    expect(other.defaultPrevented).toBe(false)
    const alt = press({ key: 'z', ctrlKey: true, altKey: true })
    expect(alt.defaultPrevented).toBe(false)
    const input = document.createElement('input')
    document.body.append(input)
    press({ key: 'z', ctrlKey: true }, input)
    input.remove()
    expect(undo).toHaveBeenCalledTimes(2)
    expect(redo).not.toHaveBeenCalled()
    dispose()
    press({ key: 'z', ctrlKey: true })
    expect(undo).toHaveBeenCalledTimes(2)
  })
})
