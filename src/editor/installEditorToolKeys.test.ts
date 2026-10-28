import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getEditorTool,
  resetEditorToolForTests,
  setEditorTool,
  subscribeEditorTool,
} from './editorToolStore'
import { installEditorToolKeys } from './installEditorToolKeys'

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  window.dispatchEvent(e)
  return e
}

describe('installEditorToolKeys', () => {
  let off: (() => void) | undefined
  afterEach(() => {
    off?.()
    off = undefined
    resetEditorToolForTests()
    vi.restoreAllMocks()
  })

  it('picks a tool and prevents the default for a hotkey', () => {
    off = installEditorToolKeys()
    expect(press('f').defaultPrevented).toBe(true)
    expect(getEditorTool()).toBe('frame')
  })

  it('leaves unknown keys alone', () => {
    off = installEditorToolKeys()
    setEditorTool('text')
    const e = press('x')
    expect(e.defaultPrevented).toBe(false)
    expect(getEditorTool()).toBe('text')
  })

  it('ignores repeat and alt-modified keys', () => {
    off = installEditorToolKeys()
    press('f', { repeat: true })
    press('f', { altKey: true })
    expect(getEditorTool()).toBe('select')
  })

  it('forgets a held Space when the window loses focus', () => {
    off = installEditorToolKeys()
    press(' ', { code: 'Space' })
    press('f')
    expect(getEditorTool()).toBe('select')
    window.dispatchEvent(new Event('blur'))
    press('f')
    expect(getEditorTool()).toBe('frame')
  })

  it('stops listening after uninstall', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    installEditorToolKeys()()
    expect(add.mock.calls.length).toBeGreaterThan(0)
    expect(remove.mock.calls).toEqual(add.mock.calls)
    press('f')
    expect(getEditorTool()).toBe('select')
  })
})

describe('editorToolStore', () => {
  afterEach(resetEditorToolForTests)

  it('notifies only on change and stops after unsubscribe', () => {
    const l = vi.fn()
    const unsub = subscribeEditorTool(l)
    setEditorTool('select')
    expect(l).not.toHaveBeenCalled()
    setEditorTool('hand')
    expect(l).toHaveBeenCalledTimes(1)
    unsub()
    setEditorTool('text')
    expect(l).toHaveBeenCalledTimes(1)
  })
})
