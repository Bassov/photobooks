import { describe, expect, it } from 'vitest'

import type { DerivedCache, DerivedCacheEntry } from './derivedCache/types'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const SAMPLE_PRESET = 'thumb'
const OTHER_HASH =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

export interface DerivedCacheContractHarness {
  cache: DerivedCache
  seedCorrupted: (assetHash: string, presetId: string) => void | Promise<void>
  /** When set, contract also checks put → new instance → get persistence. */
  recreate?: () => Promise<DerivedCache> | DerivedCache
}

function sampleEntry(): DerivedCacheEntry {
  return {
    bytes: new Uint8Array([10, 20, 30]).buffer,
    mimeType: 'image/jpeg',
  }
}

export function runDerivedCacheContract(
  createHarness: () =>
    DerivedCacheContractHarness | Promise<DerivedCacheContractHarness>,
): void {
  describe('DerivedCache contract', () => {
    it('puts and gets bytes with mime type', async () => {
      const harness = await createHarness()
      const entry = sampleEntry()

      expect(
        await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, entry),
      ).toEqual({ ok: true, value: undefined })

      const got = await harness.cache.get(SAMPLE_HASH, SAMPLE_PRESET)
      expect(got.ok).toBe(true)
      if (got.ok) {
        expect(got.value.mimeType).toBe('image/jpeg')
        expect(new Uint8Array(got.value.bytes)).toEqual(
          new Uint8Array([10, 20, 30]),
        )
      }
    })

    it('returns not-found for a missing key', async () => {
      const harness = await createHarness()
      expect(await harness.cache.get(SAMPLE_HASH, SAMPLE_PRESET)).toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('has reports existence per key across put and delete', async () => {
      const harness = await createHarness()
      expect(await harness.cache.has(SAMPLE_HASH, SAMPLE_PRESET)).toBe(false)
      await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, sampleEntry())
      expect(await harness.cache.has(SAMPLE_HASH, SAMPLE_PRESET)).toBe(true)
      expect(await harness.cache.has(OTHER_HASH, SAMPLE_PRESET)).toBe(false)
      expect(await harness.cache.has(SAMPLE_HASH, 'working-preview')).toBe(
        false,
      )
      await harness.cache.delete(SAMPLE_HASH, SAMPLE_PRESET)
      expect(await harness.cache.has(SAMPLE_HASH, SAMPLE_PRESET)).toBe(false)
    })

    it('has sees an entry stored by an earlier instance', async () => {
      const harness = await createHarness()
      await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, sampleEntry())
      const next =
        harness.recreate === undefined
          ? harness.cache
          : await harness.recreate()
      expect(await next.has(SAMPLE_HASH, SAMPLE_PRESET)).toBe(true)
      expect(await next.has(OTHER_HASH, SAMPLE_PRESET)).toBe(false)
    })

    it('returns corrupted for a seeded bad entry', async () => {
      const harness = await createHarness()
      await harness.seedCorrupted(SAMPLE_HASH, SAMPLE_PRESET)
      expect(await harness.cache.get(SAMPLE_HASH, SAMPLE_PRESET)).toEqual({
        ok: false,
        code: 'corrupted',
      })
    })

    it('deletes a single key', async () => {
      const harness = await createHarness()
      await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, sampleEntry())
      expect(await harness.cache.delete(SAMPLE_HASH, SAMPLE_PRESET)).toEqual({
        ok: true,
        value: undefined,
      })
      expect(await harness.cache.get(SAMPLE_HASH, SAMPLE_PRESET)).toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('clears all keys', async () => {
      const harness = await createHarness()
      await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, sampleEntry())
      await harness.cache.put(OTHER_HASH, SAMPLE_PRESET, sampleEntry())
      expect(await harness.cache.clear()).toEqual({
        ok: true,
        value: undefined,
      })
      expect(await harness.cache.get(SAMPLE_HASH, SAMPLE_PRESET)).toEqual({
        ok: false,
        code: 'not-found',
      })
      expect(await harness.cache.get(OTHER_HASH, SAMPLE_PRESET)).toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('survives a new adapter instance on the same root when recreate is provided', async () => {
      const harness = await createHarness()
      if (harness.recreate === undefined) {
        return
      }
      await harness.cache.put(SAMPLE_HASH, SAMPLE_PRESET, sampleEntry())
      const next = await harness.recreate()
      const got = await next.get(SAMPLE_HASH, SAMPLE_PRESET)
      expect(got.ok).toBe(true)
      if (got.ok) {
        expect(got.value.mimeType).toBe('image/jpeg')
        expect(new Uint8Array(got.value.bytes)).toEqual(
          new Uint8Array([10, 20, 30]),
        )
      }
    })
  })
}
