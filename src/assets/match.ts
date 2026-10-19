import type { Asset } from '../core'
import type { ScannedEntry } from './types'

export type AssetMatchStatus = 'ok' | 'missing' | 'modified'

export interface MatchAssetsResult {
  matched: ReadonlyMap<string, ScannedEntry>
  unmatchedAssetIds: readonly string[]
  unmatchedEntries: readonly ScannedEntry[]
  statuses: ReadonlyMap<string, AssetMatchStatus>
}

function metadataKey(
  sourceRootId: string,
  relativePath: string,
  byteSize: number,
  mtimeMs: number,
): string {
  return `${sourceRootId}\0${relativePath}\0${String(byteSize)}\0${String(mtimeMs)}`
}

function pathKey(sourceRootId: string, relativePath: string): string {
  return `${sourceRootId}\0${relativePath}`
}

function classifyStatus(
  record: Asset,
  matchedEntry: ScannedEntry | undefined,
  pathEntry: ScannedEntry | undefined,
): AssetMatchStatus {
  // Matched entries are always ok: pairing only happens via equal hash or
  // equal path+size+mtime, so a further size/hash re-check is redundant.
  if (matchedEntry !== undefined) {
    return 'ok'
  }

  if (pathEntry === undefined) {
    return 'missing'
  }

  const sizeMtimeSame =
    record.byteSize === pathEntry.byteSize &&
    record.mtimeMs === pathEntry.mtimeMs
  if (sizeMtimeSame) {
    return 'ok'
  }

  const bothHashes =
    record.contentHash !== undefined && pathEntry.contentHash !== undefined
  if (bothHashes && record.contentHash === pathEntry.contentHash) {
    return 'ok'
  }
  return 'modified'
}

/**
 * Pure match/relink: prefer contentHash, else source root + path + size + mtime.
 * Also reports per-asset `ok | missing | modified` for the scanned root.
 */
export function matchAssets(
  records: Readonly<Record<string, Asset>>,
  entries: readonly ScannedEntry[],
  options: { sourceRootId: string },
): MatchAssetsResult {
  const { sourceRootId } = options
  const matched = new Map<string, ScannedEntry>()
  const usedEntries = new Set<ScannedEntry>()

  const byHash = new Map<string, ScannedEntry[]>()
  for (const entry of entries) {
    if (entry.contentHash === undefined) {
      continue
    }
    const list = byHash.get(entry.contentHash) ?? []
    list.push(entry)
    byHash.set(entry.contentHash, list)
  }

  for (const [assetId, record] of Object.entries(records)) {
    if (record.contentHash === undefined) {
      continue
    }
    const candidates = byHash.get(record.contentHash)
    const entry = candidates?.find((item) => !usedEntries.has(item))
    if (!entry) {
      continue
    }
    matched.set(assetId, entry)
    usedEntries.add(entry)
  }

  const byMeta = new Map<string, ScannedEntry[]>()
  for (const entry of entries) {
    if (usedEntries.has(entry)) {
      continue
    }
    const key = metadataKey(
      sourceRootId,
      entry.relativePath,
      entry.byteSize,
      entry.mtimeMs,
    )
    const list = byMeta.get(key) ?? []
    list.push(entry)
    byMeta.set(key, list)
  }

  for (const [assetId, record] of Object.entries(records)) {
    if (matched.has(assetId)) {
      continue
    }
    if (
      record.sourceRootId !== sourceRootId ||
      record.relativePath === undefined ||
      record.byteSize === undefined ||
      record.mtimeMs === undefined
    ) {
      continue
    }
    const key = metadataKey(
      record.sourceRootId,
      record.relativePath,
      record.byteSize,
      record.mtimeMs,
    )
    const candidates = byMeta.get(key)
    const entry = candidates?.find((item) => !usedEntries.has(item))
    if (!entry) {
      continue
    }
    matched.set(assetId, entry)
    usedEntries.add(entry)
  }

  const byPath = new Map<string, ScannedEntry>()
  for (const entry of entries) {
    const key = pathKey(sourceRootId, entry.relativePath)
    if (!byPath.has(key)) {
      byPath.set(key, entry)
    }
  }

  const statuses = new Map<string, AssetMatchStatus>()
  for (const [assetId, record] of Object.entries(records)) {
    if (
      record.sourceRootId !== undefined &&
      record.sourceRootId !== sourceRootId
    ) {
      continue
    }
    if (
      record.sourceRootId === undefined &&
      record.relativePath === undefined &&
      record.contentHash === undefined
    ) {
      continue
    }
    const pathEntry =
      record.relativePath !== undefined
        ? byPath.get(pathKey(sourceRootId, record.relativePath))
        : undefined
    statuses.set(
      assetId,
      classifyStatus(record, matched.get(assetId), pathEntry),
    )
  }

  const unmatchedAssetIds = Object.keys(records).filter(
    (assetId) => !matched.has(assetId),
  )
  const unmatchedEntries = entries.filter((entry) => !usedEntries.has(entry))

  return { matched, unmatchedAssetIds, unmatchedEntries, statuses }
}
