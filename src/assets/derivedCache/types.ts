export interface DerivedCacheEntry {
  bytes: ArrayBuffer
  mimeType: string
}

export type DerivedCacheFailureCode = 'not-found' | 'corrupted'

export interface DerivedCacheFailure {
  ok: false
  code: DerivedCacheFailureCode
}

interface DerivedCacheSuccess<T> {
  ok: true
  value: T
}

export type DerivedCacheResult<T> = DerivedCacheSuccess<T> | DerivedCacheFailure

export interface DerivedCache {
  get: (
    assetHash: string,
    presetId: string,
  ) => Promise<DerivedCacheResult<DerivedCacheEntry>>
  /** Existence check without reading the entry bytes. */
  has: (assetHash: string, presetId: string) => Promise<boolean>
  put: (
    assetHash: string,
    presetId: string,
    entry: DerivedCacheEntry,
  ) => Promise<DerivedCacheResult<void>>
  delete: (
    assetHash: string,
    presetId: string,
  ) => Promise<DerivedCacheResult<void>>
  clear: () => Promise<DerivedCacheResult<void>>
}
