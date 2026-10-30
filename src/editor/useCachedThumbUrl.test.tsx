import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setDerivedCacheForTests } from '../assets/derivedCache/instance'
import { createMemoryDerivedCache } from '../assets/derivedCache/memory'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { useCachedThumbUrl } from './useCachedThumbUrl'

const KEY = 'a'.repeat(64)

function Probe({ cacheKey }: { cacheKey: string | undefined }) {
  const url = useCachedThumbUrl(cacheKey)
  return <span data-testid="url">{url ?? 'none'}</span>
}

describe('useCachedThumbUrl', () => {
  const revokeObjectURL = vi.fn()
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:thumb')

  beforeEach(() => {
    revokeObjectURL.mockClear()
    createObjectURL.mockClear()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    cleanup()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
  })

  it('stays empty without a key', () => {
    render(<Probe cacheKey={undefined} />)
    expect(screen.getByTestId('url').textContent).toBe('none')
  })

  it('stays empty when the cache has no thumb', async () => {
    setDerivedCacheForTests(createMemoryDerivedCache())
    render(<Probe cacheKey={KEY} />)
    await Promise.resolve()
    expect(screen.getByTestId('url').textContent).toBe('none')
  })

  it('publishes a cached thumb and revokes it on unmount', async () => {
    const cache = createMemoryDerivedCache()
    await cache.put(KEY, THUMB_PRESET_ID, {
      bytes: new Uint8Array([1, 2]).buffer,
      mimeType: 'image/webp',
    })
    setDerivedCacheForTests(cache)
    const { unmount } = render(<Probe cacheKey={KEY} />)
    await waitFor(() => {
      expect(screen.getByTestId('url').textContent).toBe('blob:thumb')
    })
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb')
  })

  it('wraps the cached bytes with their mime type', async () => {
    const cache = createMemoryDerivedCache()
    await cache.put(KEY, THUMB_PRESET_ID, {
      bytes: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'image/webp',
    })
    setDerivedCacheForTests(cache)
    render(<Probe cacheKey={KEY} />)
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1)
    })
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.size).toBe(3)
    expect(blob?.type).toBe('image/webp')
  })

  it('does not publish a thumb that lands after unmount', async () => {
    const cache = createMemoryDerivedCache()
    await cache.put(KEY, THUMB_PRESET_ID, {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/webp',
    })
    setDerivedCacheForTests(cache)
    const { unmount } = render(<Probe cacheKey={KEY} />)
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('drops the old url when the key changes to one without a thumb', async () => {
    const cache = createMemoryDerivedCache()
    await cache.put(KEY, THUMB_PRESET_ID, {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/webp',
    })
    setDerivedCacheForTests(cache)
    const { rerender } = render(<Probe cacheKey={KEY} />)
    await waitFor(() => {
      expect(screen.getByTestId('url').textContent).toBe('blob:thumb')
    })
    rerender(<Probe cacheKey={'b'.repeat(64)} />)
    expect(screen.getByTestId('url').textContent).toBe('none')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumb')
    rerender(<Probe cacheKey={undefined} />)
    expect(screen.getByTestId('url').textContent).toBe('none')
  })
})
