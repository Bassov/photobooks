import type { Asset } from '../core'
import type { ScannedEntry } from './types'

export type AssetMatchStatus = 'ok' | 'missing' | 'modified'

export interface MatchAssetsResult {
  matched: ReadonlyMap<string, ScannedEntry>
  unmatchedAssetIds: readonly string[]
  unmatchedEntries: readonly ScannedEntry[]
  statuses: ReadonlyMap<string, AssetMatchStatus>
}

/** Path + size + mtime only — source root may change on relink. */
function identityKey(
  relativePath: string,
  byteSize: number,
  mtimeMs: number,
): string {
  return `${relativePath}\0${String(byteSize)}\0${String(mtimeMs)}`
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
 * Pure match/relink on path + size + mtime only (no content-hash).
 * Source-root id is not part of identity so a fresh relink scan can rematch
 * assets bound to a previous root.
 */
export function matchAssets(
  records: Readonly<Record<string, Asset>>,
  entries: readonly ScannedEntry[],
  options: { sourceRootId: string },
): MatchAssetsResult {
  if (typeof options.sourceRootId !== 'string') {
    throw new TypeError('sourceRootId required')
  }
  const matched = new Map<string, ScannedEntry>()
  const usedEntries = new Set<ScannedEntry>()

  const byIdentity = new Map<string, ScannedEntry[]>()
  for (const entry of entries) {
    const key = identityKey(entry.relativePath, entry.byteSize, entry.mtimeMs)
    const list = byIdentity.get(key) ?? []
    list.push(entry)
    byIdentity.set(key, list)
  }

  for (const [assetId, record] of Object.entries(records)) {
    if (
      record.relativePath === undefined ||
      record.byteSize === undefined ||
      record.mtimeMs === undefined
    ) {
      continue
    }
    const key = identityKey(
      record.relativePath,
      record.byteSize,
      record.mtimeMs,
    )
    const candidates = byIdentity.get(key)
    const entry = candidates?.find((item) => !usedEntries.has(item))
    if (!entry) {
      continue
    }
    matched.set(assetId, entry)
    usedEntries.add(entry)
  }

  const byPath = new Map<string, ScannedEntry>()
  for (const entry of entries) {
    if (!byPath.has(entry.relativePath)) {
      byPath.set(entry.relativePath, entry)
    }
  }

  const statuses = new Map<string, AssetMatchStatus>()
  for (const [assetId, record] of Object.entries(records)) {
    if (
      record.relativePath === undefined &&
      record.sourceRootId === undefined
    ) {
      continue
    }
    const pathEntry =
      record.relativePath !== undefined
        ? byPath.get(record.relativePath)
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
