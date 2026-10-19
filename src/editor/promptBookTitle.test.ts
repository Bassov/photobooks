import { afterEach, describe, expect, it, vi } from 'vitest'
import { promptBookTitle } from './promptBookTitle'

describe('promptBookTitle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns entered text', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Summer'),
    )
    expect(promptBookTitle('Book title', '')).toBe('Summer')
  })

  it('returns null when cancelled', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    expect(promptBookTitle('Book title', 'x')).toBeNull()
  })
})
