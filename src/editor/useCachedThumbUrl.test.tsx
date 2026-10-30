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

  beforeEach(() => {
    revokeObjectURL.mockClear()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:thumb'),
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
})
