import { describe, expect, it } from 'vitest'
import { menuKeys } from './menuKeys'

describe('menuKeys', () => {
  it('keeps the key strings off macOS', () => {
    expect(menuKeys('Shift+Ctrl+]', false)).toBe('Shift+Ctrl+]')
    expect(menuKeys('Ctrl+Shift+L', false)).toBe('Ctrl+Shift+L')
    expect(menuKeys('Del', false)).toBe('Del')
  })

  it('shows macOS glyphs, Shift before Cmd, with no plus', () => {
    expect(menuKeys('Shift+Ctrl+]', true)).toBe('⇧⌘]')
    expect(menuKeys('Ctrl+Shift+L', true)).toBe('⇧⌘L')
    expect(menuKeys('Shift+Ctrl+V', true)).toBe('⇧⌘V')
    expect(menuKeys('Ctrl+X', true)).toBe('⌘X')
    expect(menuKeys('Ctrl+[', true)).toBe('⌘[')
    expect(menuKeys('Del', true)).toBe('⌫')
  })
})
