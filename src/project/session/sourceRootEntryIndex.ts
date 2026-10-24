import type { ScannedEntry } from '../../assets'
import type { StorageFailure, StorageResult } from '../types'
import { createSourceRootEntryIndexIdb, type SessionIdb } from './idb'

/** Current folder-manifest schema version stored in IDB. */
export const FOLDER_MANIFEST_VERSION = 1

/** One folder entry: identity for cache keys + optional display dims. */
export interface FolderManifestEntry {
  byteSize: number
  mtimeMs: number
  width?: number
  height?: number
  orientation?: number
}

/**
 * Persisted per-source-root folder manifest (path → size/mtime + optional dims).
 * Formerly “entry index”; name kept for call-site stability.
 */
export interface SourceRootEntryIndex {
  version: number
  entries: Record<string, FolderManifestEntry>
}

export interface EntryIndexDiff {
  newPaths: readonly string[]
  changedPaths: readonly string[]
  unchangedPaths: readonly string[]
  removedPaths: readonly string[]
}

export interface SourceRootEntryIndexOptions {
  entryIndexIdb?: SessionIdb
}

/** Yield cadence when merging/writing large manifests (entries per turn). */
const MANIFEST_PERSIST_CHUNK = 256

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function resolveIdb(options?: SourceRootEntryIndexOptions): SessionIdb {
  return options?.entryIndexIdb ?? createSourceRootEntryIndexIdb()
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseOrientation(value: unknown): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 8
  ) {
    return undefined
  }
  return value
}

function parseEntry(meta: unknown): FolderManifestEntry | null {
  if (typeof meta !== 'object' || meta === null) {
    return null
  }
  const row = meta as {
    byteSize?: unknown
    mtimeMs?: unknown
    width?: unknown
    height?: unknown
    orientation?: unknown
  }
  if (!isFiniteNumber(row.byteSize) || !isFiniteNumber(row.mtimeMs)) {
    return null
  }
  const entry: FolderManifestEntry = {
    byteSize: row.byteSize,
    mtimeMs: row.mtimeMs,
  }
  if (isPositiveInt(row.width) && isPositiveInt(row.height)) {
    entry.width = row.width
    entry.height = row.height
  }
  const orientation = parseOrientation(row.orientation)
  if (orientation !== undefined) {
    entry.orientation = orientation
  }
  return entry
}

/**
 * Parse stored IDB value. Corrupt or unsupported version → null (rebuild).
 * Legacy `{ entries }` without `version` is accepted as v1.
 */
export function parseFolderManifest(
  value: unknown,
): SourceRootEntryIndex | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as { version?: unknown; entries?: unknown }
  if (
    record.version !== undefined &&
    record.version !== FOLDER_MANIFEST_VERSION
  ) {
    return null
  }
  if (typeof record.entries !== 'object' || record.entries === null) {
    return null
  }
  const entries: SourceRootEntryIndex['entries'] = {}
  for (const [path, meta] of Object.entries(
    record.entries as Record<string, unknown>,
  )) {
    if (path === '') {
      continue
    }
    const entry = parseEntry(meta)
    if (entry === null) {
      continue
    }
    entries[path] = entry
  }
  return { version: FOLDER_MANIFEST_VERSION, entries }
}

/** Build a persistable manifest from a cheap scan (metadata only). */
export function entryIndexFromScanned(
  scanned: readonly ScannedEntry[],
  previous?: SourceRootEntryIndex | null,
): SourceRootEntryIndex {
  const prev = previous?.entries ?? {}
  const entries: SourceRootEntryIndex['entries'] = {}
  for (const entry of scanned) {
    const prior = prev[entry.relativePath]
    const next: FolderManifestEntry = {
      byteSize: entry.byteSize,
      mtimeMs: entry.mtimeMs,
    }
    if (prior?.byteSize === entry.byteSize && prior.mtimeMs === entry.mtimeMs) {
      copyDimsIfComplete(prior, next)
    }
    entries[entry.relativePath] = next
  }
  return { version: FOLDER_MANIFEST_VERSION, entries }
}

/**
 * Diff a prior manifest against a fresh cheap scan.
 * Callers MUST still always walk; this never substitutes for scanRoot.
 */
export function diffEntryIndex(
  previous: SourceRootEntryIndex | null,
  scanned: readonly ScannedEntry[],
): EntryIndexDiff {
  const prev = previous?.entries ?? {}
  const newPaths: string[] = []
  const changedPaths: string[] = []
  const unchangedPaths: string[] = []
  const seen = new Set<string>()

  for (const entry of scanned) {
    seen.add(entry.relativePath)
    const prior = prev[entry.relativePath]
    if (prior === undefined) {
      newPaths.push(entry.relativePath)
      continue
    }
    if (prior.byteSize !== entry.byteSize || prior.mtimeMs !== entry.mtimeMs) {
      changedPaths.push(entry.relativePath)
      continue
    }
    unchangedPaths.push(entry.relativePath)
  }

  const removedPaths = Object.keys(prev).filter((path) => !seen.has(path))
  return { newPaths, changedPaths, unchangedPaths, removedPaths }
}

export async function getSourceRootEntryIndex(
  sourceRootId: string,
  options?: SourceRootEntryIndexOptions,
): Promise<StorageResult<SourceRootEntryIndex>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  try {
    const stored = await resolveIdb(options).get(sourceRootId)
    if (!stored.present) {
      return failure('not-found')
    }
    const parsed = parseFolderManifest(stored.value)
    if (parsed === null) {
      return failure('not-found')
    }
    return success(parsed)
  } catch {
    return failure('not-found')
  }
}

export async function putSourceRootEntryIndex(
  sourceRootId: string,
  index: SourceRootEntryIndex,
  options?: SourceRootEntryIndexOptions,
): Promise<StorageResult<void>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  try {
    const payload: SourceRootEntryIndex = {
      version: FOLDER_MANIFEST_VERSION,
      entries: index.entries,
    }
    await resolveIdb(options).set(sourceRootId, payload)
    return success(undefined)
  } catch {
    return failure('not-found')
  }
}

export async function clearSourceRootEntryIndex(
  sourceRootId: string,
  options?: SourceRootEntryIndexOptions,
): Promise<StorageResult<void>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  try {
    const idb = resolveIdb(options)
    const stored = await idb.get(sourceRootId)
    if (!stored.present) {
      return failure('not-found')
    }
    await idb.del(sourceRootId)
    return success(undefined)
  } catch {
    return failure('not-found')
  }
}

export type YieldFn = () => Promise<void>

/**
 * Merge scan + prior dims into a manifest, yielding every
 * MANIFEST_PERSIST_CHUNK entries so large folders stay interruptible.
 */
async function buildManifestFromScannedChunked(
  scanned: readonly ScannedEntry[],
  previous: SourceRootEntryIndex | null,
  yieldFn: YieldFn,
): Promise<SourceRootEntryIndex> {
  const prev = previous?.entries ?? {}
  const entries: SourceRootEntryIndex['entries'] = {}
  let index = 0
  for (const entry of scanned) {
    if (index > 0 && index % MANIFEST_PERSIST_CHUNK === 0) {
      await yieldFn()
    }
    index += 1
    const prior = prev[entry.relativePath]
    const next: FolderManifestEntry = {
      byteSize: entry.byteSize,
      mtimeMs: entry.mtimeMs,
    }
    if (prior?.byteSize === entry.byteSize && prior.mtimeMs === entry.mtimeMs) {
      copyDimsIfComplete(prior, next)
    }
    entries[entry.relativePath] = next
  }
  return { version: FOLDER_MANIFEST_VERSION, entries }
}

function copyDimsIfComplete(
  prior: FolderManifestEntry,
  next: FolderManifestEntry,
): void {
  const width = prior.width
  const height = prior.height
  if (width === undefined || height === undefined) {
    return
  }
  next.width = width
  next.height = height
  const orientation = prior.orientation
  if (orientation === undefined) {
    return
  }
  next.orientation = orientation
}

/** Persist the latest cheap-scan metadata after a full walk (batched merge). */
export async function persistScannedEntryIndex(
  sourceRootId: string,
  scanned: readonly ScannedEntry[],
  options?: SourceRootEntryIndexOptions & {
    yieldFn?: YieldFn
  },
): Promise<StorageResult<void>> {
  const got = await getSourceRootEntryIndex(sourceRootId, options)
  const prior = got.ok ? got.value : null
  const yieldFn = options?.yieldFn ?? (() => Promise.resolve())
  const manifest = await buildManifestFromScannedChunked(
    scanned,
    prior,
    yieldFn,
  )
  await yieldFn()
  return putSourceRootEntryIndex(sourceRootId, manifest, options)
}

/**
 * Patch display dimensions for one path when decode completes.
 * No-op when the path is missing or size/mtime no longer match.
 */
export async function patchManifestDimensions(
  sourceRootId: string,
  entry: {
    relativePath: string
    byteSize: number
    mtimeMs: number
    width: number
    height: number
    orientation: number
  },
  options?: SourceRootEntryIndexOptions,
): Promise<StorageResult<void>> {
  if (sourceRootId === '' || entry.relativePath === '') {
    return failure('not-found')
  }
  if (
    !isPositiveInt(entry.width) ||
    !isPositiveInt(entry.height) ||
    parseOrientation(entry.orientation) === undefined
  ) {
    return failure('not-found')
  }
  const got = await getSourceRootEntryIndex(sourceRootId, options)
  if (!got.ok) {
    // Seed a single-entry manifest so later scans can merge.
    return putSourceRootEntryIndex(
      sourceRootId,
      {
        version: FOLDER_MANIFEST_VERSION,
        entries: {
          [entry.relativePath]: {
            byteSize: entry.byteSize,
            mtimeMs: entry.mtimeMs,
            width: entry.width,
            height: entry.height,
            orientation: entry.orientation,
          },
        },
      },
      options,
    )
  }
  const prior = got.value.entries[entry.relativePath]
  if (prior !== undefined) {
    if (prior.byteSize !== entry.byteSize) {
      return success(undefined)
    }
    if (prior.mtimeMs !== entry.mtimeMs) {
      return success(undefined)
    }
  }
  const next: SourceRootEntryIndex = {
    version: FOLDER_MANIFEST_VERSION,
    entries: {
      ...got.value.entries,
      [entry.relativePath]: {
        byteSize: entry.byteSize,
        mtimeMs: entry.mtimeMs,
        width: entry.width,
        height: entry.height,
        orientation: entry.orientation,
      },
    },
  }
  return putSourceRootEntryIndex(sourceRootId, next, options)
}
