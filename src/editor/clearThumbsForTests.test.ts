import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import { clearThumbsAndDerivedCacheForTests } from './clearThumbsForTests'
import {
  getThumbPublishGeneration,
  getThumbUrl,
  resetThumbCache,
  setThumbUrl,
} from './thumbCache'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('clearThumbsAndDerivedCacheForTests', () => {
  afterEach(() => {
    resetThumbCache()
    resetPendingHashesForTests()
    setDerivedCacheForTests(undefined)
    vi.restoreAllMocks()
  })

  it('clears hot thumbs and DerivedCache entries', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clear-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    setThumbUrl('a1', new Uint8Array([1, 2]).buffer, 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    const before = await cache.get(SAMPLE_HASH, 'thumb')
    expect(before.ok).toBe(true)
    assert.equal(before.ok, true)
    expect(getThumbUrl('a1')).toBeDefined()

    const genBefore = getThumbPublishGeneration()
    await clearThumbsAndDerivedCacheForTests()
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(getThumbPublishGeneration()).toBeGreaterThan(genBefore)
    const after = await cache.get(SAMPLE_HASH, 'thumb')
    expect(after.ok).toBe(false)
  })
})
