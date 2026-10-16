import type {
  DerivedCache,
  DerivedCacheEntry,
  DerivedCacheFailure,
  DerivedCacheFailureCode,
  DerivedCacheResult,
} from './types'

function cacheKey(assetHash: string, presetId: string): string {
  return `${assetHash}:${presetId}`
}

function failure(code: DerivedCacheFailureCode): DerivedCacheFailure {
  return { ok: false, code }
}

function success<T>(value: T): DerivedCacheResult<T> {
  return { ok: true, value }
}

export type MemoryDerivedCache = DerivedCache & {
  seedCorrupted: (assetHash: string, presetId: string) => void
}

export function createMemoryDerivedCache(): MemoryDerivedCache {
  const entries = new Map<string, DerivedCacheEntry | 'corrupted'>()

  return {
    get(assetHash, presetId) {
      const stored = entries.get(cacheKey(assetHash, presetId))
      if (stored === undefined) {
        return Promise.resolve(failure('not-found'))
      }
      if (stored === 'corrupted') {
        return Promise.resolve(failure('corrupted'))
      }
      return Promise.resolve(
        success({
          bytes: stored.bytes.slice(0),
          mimeType: stored.mimeType,
        }),
      )
    },

    put(assetHash, presetId, entry) {
      entries.set(cacheKey(assetHash, presetId), {
        bytes: entry.bytes.slice(0),
        mimeType: entry.mimeType,
      })
      return Promise.resolve(success(undefined))
    },

    delete(assetHash, presetId) {
      entries.delete(cacheKey(assetHash, presetId))
      return Promise.resolve(success(undefined))
    },

    clear() {
      entries.clear()
      return Promise.resolve(success(undefined))
    },

    seedCorrupted(assetHash, presetId) {
      entries.set(cacheKey(assetHash, presetId), 'corrupted')
    },
  }
}
