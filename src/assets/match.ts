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
  // Matched entries are always ok: pairing only happens via equal path+size+mtime.
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

  return 'modified'
}

/**
 * Pure match/relink on source root + path + size + mtime only.
 * Content hash is ignored for identity and status.
 */
export function matchAssets(
  records: Readonly<Record<string, Asset>>,
  entries: readonly ScannedEntry[],
  options: { sourceRootId: string },
): MatchAssetsResult {
  const { sourceRootId } = options
  const matched = new Map<string, ScannedEntry>()
  const usedEntries = new Set<ScannedEntry>()

  const byMeta = new Map<string, ScannedEntry[]>()
  for (const entry of entries) {
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
      record.relativePath === undefined
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
