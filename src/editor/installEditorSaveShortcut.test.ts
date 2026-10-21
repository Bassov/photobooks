import { afterEach, describe, expect, it, vi } from 'vitest'
import { installEditorSaveShortcut } from './installEditorSaveShortcut'
import * as projectSession from './projectSession'

describe('installEditorSaveShortcut', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves on Ctrl/Cmd+S only while the library is open', () => {
    const save = vi.spyOn(projectSession, 'saveBookNow')
    const disposeClosed = installEditorSaveShortcut(false)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true }),
    )
    expect(save).not.toHaveBeenCalled()
    disposeClosed()

    const disposeOpen = installEditorSaveShortcut(true)
    const ctrlS = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      cancelable: true,
    })
    window.dispatchEvent(ctrlS)
    expect(ctrlS.defaultPrevented).toBe(true)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true }),
    )
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'S', ctrlKey: true }),
    )
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }),
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    expect(save).toHaveBeenCalledTimes(3)
    disposeOpen()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true }),
    )
    expect(save).toHaveBeenCalledTimes(3)
  })
})
