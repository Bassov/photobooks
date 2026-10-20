import { describe, expect, it, vi } from 'vitest'
import { applyPreferredTheme, readPrefersDark } from './preferredTheme'

describe('applyPreferredTheme', () => {
  it('keeps theme b', () => {
    const root = { dataset: { theme: 'b' } as DOMStringMap }
    expect(applyPreferredTheme(root, true)).toBe('b')
    expect(root.dataset.theme).toBe('b')
  })

  it('keeps theme b-dark', () => {
    const root = { dataset: { theme: 'b-dark' } as DOMStringMap }
    expect(applyPreferredTheme(root, false)).toBe('b-dark')
    expect(root.dataset.theme).toBe('b-dark')
  })

  it('sets b when the OS prefers light', () => {
    const root = { dataset: {} as DOMStringMap }
    expect(applyPreferredTheme(root, false)).toBe('b')
    expect(root.dataset.theme).toBe('b')
  })

  it('sets b-dark when the OS prefers dark', () => {
    const root = { dataset: {} as DOMStringMap }
    expect(applyPreferredTheme(root, true)).toBe('b-dark')
    expect(root.dataset.theme).toBe('b-dark')
  })
})

describe('readPrefersDark', () => {
  it('reads matchMedia', () => {
    const matches = vi.fn(() => true)
    vi.stubGlobal('matchMedia', () => ({ matches: matches() }))
    expect(readPrefersDark()).toBe(true)
    vi.unstubAllGlobals()
  })
})
