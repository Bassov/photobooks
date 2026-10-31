import { afterEach, describe, expect, it, vi } from 'vitest'

import { focusRenameInput, shouldSkipLibraryRename } from './libraryRename'

describe('shouldSkipLibraryRename', () => {
  it('skips when titles match', () => {
    expect(shouldSkipLibraryRename('Trip', 'Trip')).toBe(true)
  })

  it('does not skip when titles differ or current is missing', () => {
    expect(shouldSkipLibraryRename('Trip', 'Home')).toBe(false)
    expect(shouldSkipLibraryRename(undefined, '')).toBe(false)
  })
})

describe('focusRenameInput', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function mountInput(): HTMLInputElement {
    const input = document.createElement('input')
    document.body.append(input)
    return input
  }

  it('focuses the field on the next frame, after the menu restores focus', () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
    })
    const input = mountInput()
    const cleanup = focusRenameInput(input)
    expect(document.activeElement).not.toBe(input)
    vi.advanceTimersToNextFrame()
    expect(document.activeElement).toBe(input)
    expect(cleanup).toBeTypeOf('function')
  })

  it('cancels the pending focus when the field unmounts first', () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
    })
    const input = mountInput()
    focusRenameInput(input)?.()
    vi.advanceTimersToNextFrame()
    expect(document.activeElement).not.toBe(input)
  })

  it('does nothing for a detached ref', () => {
    expect(focusRenameInput(null)).toBeUndefined()
  })
})
