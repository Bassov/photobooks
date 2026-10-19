import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'

import { runDerivedCacheContract } from '../derivedCache.contract.test-helpers'
import { createMemoryDerivedCache } from './memory'

runDerivedCacheContract(() => {
  const cache = createMemoryDerivedCache()
  return {
    cache,
    seedCorrupted: (assetHash, presetId) => {
      cache.seedCorrupted(assetHash, presetId)
    },
  }
})

describe('memory DerivedCache isolation', () => {
  it('returns a copy so mutating get bytes does not change the store', async () => {
    const cache = createMemoryDerivedCache()
    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    await cache.put(hash, 'thumb', {
      bytes: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'image/jpeg',
    })
    const first = await cache.get(hash, 'thumb')
    expect(first.ok).toBe(true)
    assert.equal(first.ok, true)
    new Uint8Array(first.value.bytes)[0] = 99
    const second = await cache.get(hash, 'thumb')
    expect(second.ok).toBe(true)
    assert.equal(second.ok, true)
    expect(new Uint8Array(second.value.bytes)[0]).toBe(1)
  })
})
