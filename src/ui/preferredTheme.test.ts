import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyBootTheme,
  getProductTheme,
  readPrefersDark,
  readStoredTheme,
  resolveBootTheme,
  setTheme,
  subscribeProductTheme,
  THEME_STORAGE_KEY,
  useProductTheme,
} from './preferredTheme'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.dataset.theme = 'b'
  setTheme('b', document.documentElement, null)
})

describe('readPrefersDark', () => {
  it('reads matchMedia', () => {
    const matches = vi.fn(() => true)
    vi.stubGlobal('matchMedia', () => ({ matches: matches() }))
    expect(readPrefersDark()).toBe(true)
  })
})

describe('resolveBootTheme / storage', () => {
  it('prefers stored theme over OS preference', () => {
    expect(resolveBootTheme(true, 'b')).toBe('b')
    expect(resolveBootTheme(false, 'b-dark')).toBe('b-dark')
  })

  it('falls back to prefers when storage is empty', () => {
    expect(resolveBootTheme(true, null)).toBe('b-dark')
    expect(resolveBootTheme(false, null)).toBe('b')
  })

  it('returns null for missing storage without throwing', () => {
    expect(readStoredTheme(null)).toBeNull()
  })

  it('reads only valid stored values', () => {
    const getItem = vi.fn((key: string) => {
      expect(key).toBe(THEME_STORAGE_KEY)
      return 'nope'
    })
    expect(readStoredTheme({ getItem })).toBeNull()
    getItem.mockReturnValue('b')
    expect(readStoredTheme({ getItem })).toBe('b')
    getItem.mockReturnValue('b-dark')
    expect(readStoredTheme({ getItem })).toBe('b-dark')
  })

  it('applyBootTheme writes one root attribute from storage', () => {
    const root = { dataset: {} as DOMStringMap }
    const storage = { getItem: vi.fn(() => 'b-dark') }
    expect(applyBootTheme(root, false, storage)).toBe('b-dark')
    expect(root.dataset.theme).toBe('b-dark')
    expect(getProductTheme()).toBe('b-dark')
  })

  it('applyBootTheme uses prefers when storage is null', () => {
    const root = { dataset: {} as DOMStringMap }
    expect(applyBootTheme(root, true, null)).toBe('b-dark')
    expect(root.dataset.theme).toBe('b-dark')
  })
})

describe('setTheme', () => {
  it('writes dataset + storage and notifies subscribers', () => {
    const root = { dataset: { theme: 'b' } as DOMStringMap }
    const setItem = vi.fn()
    const listener = vi.fn()
    const unsubscribe = subscribeProductTheme(listener)

    setTheme('b-dark', root, { setItem })

    expect(root.dataset.theme).toBe('b-dark')
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'b-dark')
    expect(listener).toHaveBeenCalledOnce()
    expect(getProductTheme()).toBe('b-dark')
    unsubscribe()
  })

  it('skips setItem when storage is null but still notifies', () => {
    const root = { dataset: { theme: 'b' } as DOMStringMap }
    const listener = vi.fn()
    const unsubscribe = subscribeProductTheme(listener)
    setTheme('b-dark', root, null)
    expect(root.dataset.theme).toBe('b-dark')
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('unsubscribe stops further notifications', () => {
    const root = { dataset: { theme: 'b' } as DOMStringMap }
    const listener = vi.fn()
    const unsubscribe = subscribeProductTheme(listener)
    unsubscribe()
    setTheme('b-dark', root, null)
    expect(listener).not.toHaveBeenCalled()
  })

  it('useProductTheme tracks setTheme', () => {
    const { result } = renderHook(() => useProductTheme())
    expect(result.current).toBe('b')
    act(() => {
      setTheme('b-dark', document.documentElement, null)
    })
    expect(result.current).toBe('b-dark')
  })
})
