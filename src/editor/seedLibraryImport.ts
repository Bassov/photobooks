import { createMemoryAssetSource, type MemoryAssetSource } from '../assets'
import { getBookStoreSnapshot, patchAssetRecord } from './bookStore'
import {
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'

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
 * Seed library identity (path/size/mtime) and optional memory bytes for decode.
 * Does not compute content hashes on the import/rescan hot path.
 */
export function seedLibraryEntry(options: {
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
  patchAssetRecord(assetId, {
    sourceRootId:
      getBookStoreSnapshot().book.assets[assetId]?.sourceRootId ?? sourceRootId,
    relativePath,
    byteSize: file.size,
    mtimeMs: file.lastModified,
  })
  const load =
    preloaded !== undefined ? Promise.resolve(preloaded) : file.arrayBuffer()
  return load.then((bytes) => {
    memorySource.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
  })
}
