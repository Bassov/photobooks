import {
  createMemoryAssetSource,
  matchAssets,
  type ScannedEntry,
} from '../../assets'
import { getBookStoreSnapshot } from '../bookStore'
import { relativePathFor } from '../importBodyReads'
import { registerAssetSource } from '../projectSession'
import {
  applyRelinkEntries,
  mergeMatchStatuses,
  type RelinkApplyEntry,
} from './apply'
import {
  appendScannedEntry,
  emptyRescanResult,
  locateDecision,
  progressDone,
  progressStart,
  progressTick,
  resolvePendingCount,
  scanTotal,
  stageRescanMatches,
} from './stageRescanMatches'
import {
  clearRelinkFound,
  getRelinkStatuses,
  markRelinkFound,
  replaceRelinkStatuses,
  setRelinkProgress,
  type RelinkProgress,
} from './statusStore'
import { yieldForPaint } from './yieldForPaint'

export interface RescanResult {
  matched: RelinkApplyEntry[]
  sourceRootId: string
  byAssetId: ReadonlyMap<string, { entry: ScannedEntry; file: File }>
}

let pendingMatches: RescanResult | null = null

function reportProgress(
  onProgress: ((state: RelinkProgress) => void) | undefined,
  state: RelinkProgress,
): void {
  setRelinkProgress(state)
  onProgress?.(state)
}

/**
 * Rescan files: memory AssetSource + worker scan + matchAssets on path/size/mtime.
 * Stages matches for Resolve. No content-hash on the match hot path.
 */
export async function rescanRelinkFiles(
  files: readonly File[],
  options?: {
    onProgress?: (state: RelinkProgress) => void
    sourceRootId?: string
  },
): Promise<RescanResult> {
  const onProgress = options?.onProgress
  const sourceRootId = options?.sourceRootId ?? `relink-${crypto.randomUUID()}`
  const memory = createMemoryAssetSource()
  registerAssetSource(sourceRootId, memory)

  const pathToFile = new Map<string, File>()
  reportProgress(onProgress, progressStart(files.length))
  for (const file of files) {
    const relativePath = relativePathFor(file)
    pathToFile.set(relativePath, file)
    // Seed size/mtime into the memory source without requiring hash for match.
    const bytes = await file.arrayBuffer()
    memory.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
    await yieldForPaint()
  }

  const scanned = await memory.scanRoot(sourceRootId)
  if (!scanned.ok) {
    reportProgress(onProgress, progressDone(Math.max(files.length, 1)))
    const empty = emptyRescanResult(sourceRootId)
    pendingMatches = empty
    return empty
  }

  const entries: ScannedEntry[] = []
  let completed = 0
  const total = scanTotal(scanned.value.length)
  for (const entry of scanned.value) {
    appendScannedEntry(entries, entry, undefined)
    completed += 1
    reportProgress(onProgress, progressTick(total, completed))
    await yieldForPaint()
  }

  const book = getBookStoreSnapshot().book
  const match = matchAssets(book.assets, entries, { sourceRootId })
  mergeMatchStatuses(match.statuses)
  const staged = stageRescanMatches(match, pathToFile, entries, book.assets)

  clearRelinkFound()
  markRelinkFound(staged.matched.map((item) => item.assetId))

  pendingMatches = {
    matched: staged.matched,
    sourceRootId,
    byAssetId: staged.byAssetId,
  }
  reportProgress(onProgress, progressDone(total))
  return pendingMatches
}

export function getPendingRelinkMatches(): RescanResult | null {
  return pendingMatches
}

export function clearPendingRelinkMatches(): void {
  pendingMatches = null
  clearRelinkFound()
}

export async function resolvePendingRelink(): Promise<number> {
  const count = resolvePendingCount(pendingMatches)
  if (count === 0 || pendingMatches === null) {
    return 0
  }
  const pending = pendingMatches
  await applyRelinkEntries(pending.matched, {
    sourceRootId: pending.sourceRootId,
  })
  clearPendingRelinkMatches()
  const remaining = new Map(
    [...getRelinkStatuses()].filter(([, status]) => status !== 'ok'),
  )
  replaceRelinkStatuses(remaining)
  setRelinkProgress(null)
  return count
}

export async function acceptModifiedAsset(assetId: string): Promise<boolean> {
  const pending = pendingMatches
  if (pending === null) {
    return false
  }
  const hit = pending.byAssetId.get(assetId)
  if (hit === undefined) {
    return false
  }
  await applyRelinkEntries([{ assetId, entry: hit.entry, file: hit.file }], {
    sourceRootId: pending.sourceRootId,
  })
  return true
}

/**
 * Per-row Locate: match the picked file to the asset by size+mtime (no content-hash).
 * Return codes keep historical names (`hash-mismatch` / `no-hash`) for callers.
 */
export async function locateMissingAsset(
  assetId: string,
  file: File,
): Promise<'ok' | 'hash-mismatch' | 'no-hash'> {
  const asset = getBookStoreSnapshot().book.assets[assetId]
  const expectedSize = asset?.byteSize
  const expectedMtime = asset?.mtimeMs
  if (expectedSize === undefined || expectedMtime === undefined) {
    return 'no-hash'
  }
  const decision = locateDecision(
    `${String(expectedSize)}\0${String(expectedMtime)}`,
    `${String(file.size)}\0${String(file.lastModified)}`,
  )
  if (decision !== 'ok') {
    return decision
  }
  const relativePath = relativePathFor(file)
  const sourceRootId =
    pendingMatches?.sourceRootId ?? `relink-${crypto.randomUUID()}`
  const entry: ScannedEntry = {
    relativePath,
    byteSize: file.size,
    mtimeMs: file.lastModified,
  }
  await applyRelinkEntries([{ assetId, entry, file }], { sourceRootId })
  markRelinkFound([assetId])
  return 'ok'
}
