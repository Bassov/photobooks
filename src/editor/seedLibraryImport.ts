import {
  createMemoryAssetSource,
  hashContent,
  type MemoryAssetSource,
} from '../assets'
import { getAssetContentHash, patchAssetRecord } from './bookStore'
import { trackHashJob } from './pendingHashes'
import { getRegisteredAssetSource, registerAssetSource } from './projectSession'
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
  registerAssetSource(rootId, created)
  return created
}

export function seedAndHashEntry(options: {
  assetId: string
  file: File
  relativePath: string
  sourceRootId: string
  memorySource: MemoryAssetSource
  /** When set, skip a second body read. */
  bytes?: ArrayBuffer
  /** When set, skip hashContent and patch/put caches for this hash. */
  contentHash?: string
}): Promise<void> {
  const {
    assetId,
    file,
    relativePath,
    sourceRootId,
    memorySource,
    bytes: preloaded,
    contentHash: knownHash,
  } = options
  const resolvedHash = knownHash ?? getAssetContentHash(assetId)
  const load =
    preloaded !== undefined ? Promise.resolve(preloaded) : file.arrayBuffer()
  return load.then((bytes) => {
    memorySource.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
    if (resolvedHash !== undefined) return
    if (typeof Worker === 'undefined') {
      return
    }
    const hashJob = hashContent(bytes)
    void trackHashJob(
      hashJob.then(async (contentHash) => {
        patchAssetRecord(assetId, { contentHash })
        await Promise.all([
          putCachedThumbForHash(assetId, contentHash),
          putCachedTierForHash(assetId, contentHash),
        ])
        return contentHash
      }),
    ).catch(() => {
      // Hash is best-effort; identity path/size/mtime still persist.
    })
  })
}
