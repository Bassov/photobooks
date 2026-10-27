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
    press({ key: 'z' })
    press({ key: 'y', ctrlKey: true, shiftKey: true })
    const input = document.createElement('input')
    document.body.append(input)
    press({ key: 'z', ctrlKey: true }, input)
    input.remove()
    expect(undo).toHaveBeenCalledTimes(2)
    expect(redo).toHaveBeenCalledTimes(2)
    dispose()
    press({ key: 'z', ctrlKey: true })
    expect(undo).toHaveBeenCalledTimes(2)
  })
})
