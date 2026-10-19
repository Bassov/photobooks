import type { Asset } from '../core'
import { enqueueHash } from '../photo/assetPool'
import { whenMetadataIdle } from '../photo/poolCoordination'
import type { ScannedEntry } from './types'

export function shouldReuseContentHash(
  record: Asset,
  entry: ScannedEntry,
  sourceRootId: string,
): boolean {
  return (
    record.sourceRootId === sourceRootId &&
    typeof record.contentHash === 'string' &&
    record.contentHash.length === 64 &&
    record.relativePath !== undefined &&
    record.byteSize !== undefined &&
    record.mtimeMs !== undefined &&
    record.relativePath === entry.relativePath &&
    record.byteSize === entry.byteSize &&
    record.mtimeMs === entry.mtimeMs
  )
}

export async function hashContent(buffer: ArrayBuffer): Promise<string> {
  // Metadata jobs run at background priority above hash.
  await whenMetadataIdle()
  return enqueueHash(buffer)
}

export async function resolveContentHash(options: {
  record: Asset
  entry: ScannedEntry
  sourceRootId: string
  read: () => Promise<ArrayBuffer>
}): Promise<string> {
  const { record, entry, sourceRootId, read } = options
  if (
    shouldReuseContentHash(record, entry, sourceRootId) &&
    record.contentHash !== undefined
  ) {
    return record.contentHash
  }
  const buffer = await read()
  return hashContent(buffer)
}
