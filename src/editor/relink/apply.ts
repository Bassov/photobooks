import type { ScannedEntry } from '../../assets'
import { retainAssetSource } from '../../photo/assetSources'
import { patchAssetRecord } from '../bookStore'
import { registerAssetSource } from '../projectSession'
import { memorySourceForRoot } from '../seedLibraryImport'
import {
  getRelinkStatuses,
  patchRelinkStatus,
  replaceRelinkStatuses,
  type RelinkStatus,
} from './statusStore'

export interface RelinkApplyEntry {
  assetId: string
  entry: ScannedEntry
  file: File
}

/**
 * Apply matched (or explicitly accepted modified) entries: patch identity,
 * reattach Files, register memory source root, mark status `ok`.
 */
export async function applyRelinkEntries(
  entries: readonly RelinkApplyEntry[],
  options: { sourceRootId: string },
): Promise<void> {
  const { sourceRootId } = options
  if (entries.length === 0) {
    return
  }
  const memory = memorySourceForRoot(sourceRootId)
  registerAssetSource(sourceRootId, memory)

  for (const { assetId, entry, file } of entries) {
    const bytes = await file.arrayBuffer()
    patchAssetRecord(assetId, {
      sourceRootId,
      relativePath: entry.relativePath,
      byteSize: entry.byteSize,
      mtimeMs: entry.mtimeMs,
      ...(entry.contentHash !== undefined
        ? { contentHash: entry.contentHash }
        : {}),
    })
    retainAssetSource(assetId, file)
    memory.seedFile(sourceRootId, entry.relativePath, bytes, entry.mtimeMs)
    patchRelinkStatus(assetId, 'ok')
  }
}

/**
 * Drop `ok` rows from the store; keep missing/modified from a match pass.
 */
export function mergeMatchStatuses(
  statuses: ReadonlyMap<string, RelinkStatus>,
): void {
  const next = new Map(getRelinkStatuses())
  for (const [assetId, status] of statuses) {
    if (status === 'ok') {
      next.delete(assetId)
      continue
    }
    next.set(assetId, status)
  }
  replaceRelinkStatuses(next)
}
