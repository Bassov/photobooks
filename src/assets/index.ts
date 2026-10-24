export type {
  AssetSource,
  AssetSourceFailure,
  AssetSourceFailureCode,
  AssetSourceResult,
  ScannedEntry,
} from './types'
export { createMemoryAssetSource, type MemoryAssetSource } from './memory'
export { createFsaAssetSource, type FsaAssetSource } from './fsa/fsaAssetSource'
export type { AssetDirectoryHandle, AssetFileHandle } from './fsa/handles'
export { createMemoryAssetDirectory } from './fsa/memoryDirectory'
export {
  cacheKeyFromIdentity,
  identityKeyString,
  tryCacheKeyFromAsset,
  type AssetIdentityKey,
} from './cacheKey'
export {
  matchAssets,
  type AssetMatchStatus,
  type MatchAssetsResult,
} from './match'
export {
  extractAssetMetadata,
  mapExifToAssetMetadata,
  type ExtractAssetMetadataOptions,
  type ExtractedAssetMetadata,
} from './extractAssetMetadata'
export { resetScanWorker } from './scanClient'
export type {
  DerivedCache,
  DerivedCacheEntry,
  DerivedCacheFailure,
  DerivedCacheFailureCode,
  DerivedCacheResult,
} from './derivedCache/types'
export {
  createMemoryDerivedCache,
  type MemoryDerivedCache,
} from './derivedCache/memory'
export {
  createOpfsDerivedCache,
  type OpfsDerivedCache,
  type OpfsDerivedCacheOptions,
} from './derivedCache/opfs'
export {
  getDerivedCache,
  setDerivedCacheForTests,
} from './derivedCache/instance'
export { THUMB_PRESET_ID, tierPresetId } from './derivedCache/presets'
