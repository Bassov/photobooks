import type { Asset } from '../../core'
import type {
  AssetMatchStatus,
  MatchAssetsResult,
  ScannedEntry,
} from '../../assets'
import type { RelinkApplyEntry } from './apply'

export interface StagedRescan {
  matched: RelinkApplyEntry[]
  byAssetId: Map<string, { entry: ScannedEntry; file: File }>
}

/**
 * Pure staging after scan+hash+match: pair matched entries to Files and index
 * modified path hits for "Use new version".
 */
export function stageRescanMatches(
  match: MatchAssetsResult,
  pathToFile: ReadonlyMap<string, File>,
  entries: readonly ScannedEntry[],
  assets: Readonly<Record<string, Asset | undefined>>,
): StagedRescan {
  const matched: RelinkApplyEntry[] = []
  const byAssetId = new Map<string, { entry: ScannedEntry; file: File }>()

  for (const [assetId, entry] of match.matched) {
    const file = pathToFile.get(entry.relativePath)
    if (file === undefined) {
      continue
    }
    matched.push({ assetId, entry, file })
    byAssetId.set(assetId, { entry, file })
  }

  for (const [assetId, status] of match.statuses) {
    indexModifiedHit(assetId, status, byAssetId, pathToFile, entries, assets)
  }

  return { matched, byAssetId }
}

function indexModifiedHit(
  assetId: string,
  status: AssetMatchStatus,
  byAssetId: Map<string, { entry: ScannedEntry; file: File }>,
  pathToFile: ReadonlyMap<string, File>,
  entries: readonly ScannedEntry[],
  assets: Readonly<Record<string, Asset | undefined>>,
): void {
  if (status !== 'modified' || byAssetId.has(assetId)) {
    return
  }
  const path = assets[assetId]?.relativePath
  if (path === undefined) {
    return
  }
  const file = pathToFile.get(path)
  const entry = entries.find((item) => item.relativePath === path)
  if (file === undefined || entry === undefined) {
    return
  }
  byAssetId.set(assetId, { entry, file })
}

export function emptyRescanResult(sourceRootId: string): {
  matched: RelinkApplyEntry[]
  sourceRootId: string
  byAssetId: Map<string, { entry: ScannedEntry; file: File }>
} {
  return {
    matched: [],
    sourceRootId,
    byAssetId: new Map(),
  }
}

export function progressStart(fileCount: number): {
  total: number
  completed: number
  running: boolean
} {
  return {
    total: Math.max(fileCount, 1),
    completed: 0,
    running: true,
  }
}

export function progressDone(total: number): {
  total: number
  completed: number
  running: boolean
} {
  return { total, completed: total, running: false }
}

export function progressTick(
  total: number,
  completed: number,
): { total: number; completed: number; running: boolean } {
  return { total, completed, running: true }
}

export function scanTotal(entryCount: number): number {
  return Math.max(entryCount, 1)
}

export function resolvePendingCount(
  pending: { matched: readonly unknown[] } | null,
): number {
  if (pending === null || pending.matched.length === 0) {
    return 0
  }
  return pending.matched.length
}

export function locateDecision(
  expectedHash: string | undefined,
  actualHash: string,
): 'ok' | 'hash-mismatch' | 'no-hash' {
  if (expectedHash === undefined) {
    return 'no-hash'
  }
  if (actualHash !== expectedHash) {
    return 'hash-mismatch'
  }
  return 'ok'
}

/** Append a scan entry, optionally with a freshly computed content hash. */
export function appendScannedEntry(
  entries: ScannedEntry[],
  entry: ScannedEntry,
  contentHash: string | undefined,
): void {
  if (contentHash === undefined) {
    entries.push(entry)
    return
  }
  entries.push({ ...entry, contentHash })
}
