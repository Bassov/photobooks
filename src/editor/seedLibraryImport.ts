import {
  createMemoryAssetSource,
  type AssetSource,
  type MemoryAssetSource,
} from '../assets'
import { tryCacheKeyFromAsset } from '../assets/cacheKey'
import { getBookStoreSnapshot } from './bookStore'
import { trackHashJob } from './pendingHashes'
import {
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'
import { putCachedThumbForHash } from './thumbCache'
import { putCachedTierForHash } from '../photo/tierCache'

function isMemorySource(source: AssetSource): source is MemoryAssetSource {
  return typeof (source as MemoryAssetSource).seedFile === 'function'
}

export function memorySourceForRoot(rootId: string): MemoryAssetSource {
  const existing = getRegisteredAssetSource(rootId)
  if (existing !== undefined && isMemorySource(existing)) {
    return existing
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
 * Library seed keeps bytes only for memory-backed roots: a registered memory
 * source, or none yet (`memorySourceForRoot` registers one). FSA roots
 * re-resolve files from the folder handle, so their bytes are never seeded.
 */
export function isMemoryBackedRoot(rootId: string): boolean {
  const existing = getRegisteredAssetSource(rootId)
  return existing === undefined || isMemorySource(existing)
}

function putIdentityCaches(
  assetId: string,
  file: File,
  relativePath: string,
  sourceRootId: string,
): void {
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
    ]),
  ).catch(() => {
    // Identity-keyed puts are best-effort; hot LRU still holds the session.
  })
}

/**
 * Seed the memory asset source (when given) and put any already-encoded
 * thumbs/tiers under the identity cache key. Without `memorySource` (FSA
 * roots) only the identity puts run: no body read, no seed. Does not run
 * whole-file content hashing.
 */
export function seedAndHashEntry(options: {
  assetId: string
  file: File
  relativePath: string
  sourceRootId: string
  memorySource?: MemoryAssetSource
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
  if (memorySource === undefined) {
    putIdentityCaches(assetId, file, relativePath, sourceRootId)
    return Promise.resolve()
  }
  const load =
    preloaded !== undefined ? Promise.resolve(preloaded) : file.arrayBuffer()
  return load.then((bytes) => {
    memorySource.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
    putIdentityCaches(assetId, file, relativePath, sourceRootId)
  })
}
