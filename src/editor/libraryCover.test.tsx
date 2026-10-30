import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setDerivedCacheForTests } from '../assets/derivedCache/instance'
import { createMemoryDerivedCache } from '../assets/derivedCache/memory'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { BookTile } from './BookTile'
import { toLibraryGridBook } from './libraryBookFilter'

const KEY = 'b'.repeat(64)

describe('toLibraryGridBook cover', () => {
  it('maps the cache key and crop center to an object position', () => {
    const grid = toLibraryGridBook({
      id: '1',
      title: 'Fog',
      coverCacheKey: KEY,
      coverCenter: { x: 0.25, y: 0.5 },
    })
    expect(grid.coverCacheKey).toBe(KEY)
    expect(grid.coverPos).toBe('25% 50%')
  })

  it('leaves the position out without a center, and the key without a cover', () => {
    const noCenter = toLibraryGridBook({
      id: '1',
      title: 'Fog',
      coverCacheKey: KEY,
    })
    expect('coverPos' in noCenter).toBe(false)
    const none = toLibraryGridBook({ id: '2', title: 'X' })
    expect('coverCacheKey' in none).toBe(false)
  })
})

describe('BookTile cover photo', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:cover'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
  })

  it('paints the cached cover photo with light title ink', async () => {
    const cache = createMemoryDerivedCache()
    await cache.put(KEY, THUMB_PRESET_ID, {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/webp',
    })
    setDerivedCacheForTests(cache)
    render(
      <BookTile
        book={{
          id: 'b1',
          title: 'Fog',
          displayTitle: 'Fog',
          fmt: 'portrait',
          spreads: 3,
          coverCacheKey: KEY,
          coverPos: '30% 40%',
        }}
      />,
    )
    expect(screen.queryByTestId('book-object-cover')).toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('book-object-cover')).toBeTruthy()
    })
    const cover = screen.getByTestId('book-object-cover')
    expect(cover.style.backgroundImage).toContain('blob:cover')
    expect(cover.style.backgroundPosition).toBe('30% 40%')
    expect(screen.getByTestId('book-object-ink').style.color).toBe('#F5F5F5')
  })
})
