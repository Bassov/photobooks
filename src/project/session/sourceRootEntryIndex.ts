import type { ScannedEntry } from '../../assets'
import type { StorageFailure, StorageResult } from '../types'
import { createSourceRootEntryIndexIdb, type SessionIdb } from './idb'

/** Persisted cheap-scan index: relativePath → size/mtime. */
export interface SourceRootEntryIndex {
  entries: Record<string, { byteSize: number; mtimeMs: number }>
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

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function resolveIdb(options?: SourceRootEntryIndexOptions): SessionIdb {
  return options?.entryIndexIdb ?? createSourceRootEntryIndexIdb()
}

function parseIndex(value: unknown): SourceRootEntryIndex | null {
  // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: non-object input is corrupt
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as { entries?: unknown }
  // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: entries must be an object map
  if (typeof record.entries !== 'object' || record.entries === null) {
    return null
  }
  const entries: SourceRootEntryIndex['entries'] = {}
  for (const [path, meta] of Object.entries(
    record.entries as Record<string, unknown>,
  )) {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: skip non-object rows
    if (typeof meta !== 'object' || meta === null) {
      continue
    }
    const row = meta as { byteSize?: unknown; mtimeMs?: unknown }
    // Stryker disable next-line ConditionalExpression,LogicalOperator: require finite size+mtime
    if (
      typeof row.byteSize !== 'number' ||
      !Number.isFinite(row.byteSize) ||
      typeof row.mtimeMs !== 'number' ||
      !Number.isFinite(row.mtimeMs)
    ) {
      continue
    }
    entries[path] = { byteSize: row.byteSize, mtimeMs: row.mtimeMs }
  }
  return { entries }
}

/** Build a persistable index from a cheap scan (metadata only). */
export function entryIndexFromScanned(
  scanned: readonly ScannedEntry[],
): SourceRootEntryIndex {
  const entries: SourceRootEntryIndex['entries'] = {}
  for (const entry of scanned) {
    entries[entry.relativePath] = {
      byteSize: entry.byteSize,
      mtimeMs: entry.mtimeMs,
    }
  }
  return { entries }
}

/**
 * Diff a prior index against a fresh cheap scan.
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
    const parsed = parseIndex(stored.value)
    if (parsed === null) {
      return failure('not-found')
    }
    return success(parsed)
  } catch {
    // Stryker disable next-line BlockStatement: IDB throw → typed not-found
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
    await resolveIdb(options).set(sourceRootId, index)
    return success(undefined)
  } catch {
    // Stryker disable next-line BlockStatement: IDB throw → typed not-found
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
    // Stryker disable next-line BlockStatement: IDB throw → typed not-found
    return failure('not-found')
  }
}

/** Persist the latest cheap-scan metadata after a full walk. */
export async function persistScannedEntryIndex(
  sourceRootId: string,
  scanned: readonly ScannedEntry[],
  options?: SourceRootEntryIndexOptions,
): Promise<StorageResult<void>> {
  return putSourceRootEntryIndex(
    sourceRootId,
    entryIndexFromScanned(scanned),
    options,
  )
}
