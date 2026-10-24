import { createMemoryAssetSource, type MemoryAssetSource } from '../assets'
import { tryCacheKeyFromAsset } from '../assets/cacheKey'
import { getBookStoreSnapshot } from './bookStore'
import { trackHashJob } from './pendingHashes'
import {
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'
import { putCachedThumbForHash } from './thumbCache'
import { putCachedTierForHash } from '../photo/tierCache'

export function memorySourceForRoot(rootId: string): MemoryAssetSource {
  const existing = getRegisteredAssetSource(rootId)
  if (
    existing !== undefined &&
    typeof (existing as MemoryAssetSource).seedFile === 'function'
  ) {
    return existing as MemoryAssetSource
  }
  const created = createMemoryAssetSource()
  // Do not overwrite an FSA (or other non-memory) root already registered for
  // durable handle + path resolution after reload.
  if (existing === undefined) {
    registerAssetSource(rootId, created)
  }
  return created
}

/**
 * Seed the memory asset source and put any already-encoded thumbs/tiers under
 * the identity cache key. Does not run whole-file content hashing.
 */
export function seedAndHashEntry(options: {
  assetId: string
  file: File
  relativePath: string
  sourceRootId: string
  memorySource: MemoryAssetSource
  /** When set, skip a second body read. */
  bytes?: ArrayBuffer
}): Promise<void> {
  const {
    assetId,
    file,
    relativePath,
    sourceRootId,
    memorySource,
    bytes: preloaded,
  } = options
  const load =
    preloaded !== undefined ? Promise.resolve(preloaded) : file.arrayBuffer()
  return load.then((bytes) => {
    memorySource.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
    const asset = getBookStoreSnapshot().book.assets[assetId]
    const cacheKey = tryCacheKeyFromAsset({
      sourceRootId: asset?.sourceRootId ?? sourceRootId,
      relativePath: asset?.relativePath ?? relativePath,
      byteSize: asset?.byteSize ?? file.size,
      mtimeMs: asset?.mtimeMs ?? file.lastModified,
    })
    if (cacheKey === undefined) {
      return
    }
    void trackHashJob(
      Promise.all([
        putCachedThumbForHash(assetId, cacheKey),
        putCachedTierForHash(assetId, cacheKey),
      ]).then(() => cacheKey),
    ).catch(() => {
      // Identity-keyed puts are best-effort; hot LRU still holds the session.
    })
  })
}
