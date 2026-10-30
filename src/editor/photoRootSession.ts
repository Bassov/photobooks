import {
  createFsaAssetSource,
  type AssetSource,
  type ScannedEntry,
} from '../assets'
import {
  placementCountByAsset,
  type Asset,
  type Book,
  type Spread,
} from '../core'
import { retainAssetSource } from '../photo/assetSources'
import { setCoverSelected } from './coverSelection'
import { yieldForPaint } from './relink/yieldForPaint'
import { resolveRelativeFile } from '../assets/resolveRelativeFile'
import type { AssetDirectoryHandle } from '../assets/fsa/handles'
import type { ImportFileError } from '../photo/assetPool'
import { IMPORT_BODY_READ_CAP, mapWithConcurrency } from './importBodyReads'
import type { ImportPhotoResult, ImportProgress } from './importPhotos'
import { runChromeImport } from './runChromeImport'
import {
  clearBookPhotoRoot,
  clearSourceRootHandle,
  getBookPhotoRoot,
  peekSourceRootHandle,
  recallSourceRootHandle,
  rememberSourceRootHandle,
  setBookPhotoRoot,
  type BookPhotoRoot,
} from '../project/session/browserSourceRootHandles'
import {
  clearSourceRootEntryIndex,
  diffEntryIndex,
  getSourceRootEntryIndex,
  persistScannedEntryIndex,
} from '../project/session/sourceRootEntryIndex'
import {
  enqueueManifestGalleryList,
  enqueueScannedGalleryList,
} from './enqueueScannedGalleryList'
import { isAcceptedPhotoPath } from '../photo/pickPhotos'
import {
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'
import {
  awaitPendingGalleryFlush,
  getBookStoreSnapshot,
  patchAssetRecord,
  removeFailedImportAssets,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'

export type PhotoAccessPhase = 'idle' | 'permission-required'

let activeSpreadId: string | null = null
const activeSpreadListeners = new Set<() => void>()

export function getActiveSpreadId(): string | null {
  return activeSpreadId
}

export function subscribeActiveSpreadId(listener: () => void): () => void {
  activeSpreadListeners.add(listener)
  return () => {
    activeSpreadListeners.delete(listener)
  }
}

export function setActiveSpreadId(next: string | null): void {
  if (next === activeSpreadId) {
    return
  }
  activeSpreadId = next
  setCoverSelected(false)
  for (const listener of activeSpreadListeners) {
    listener()
  }
}

const spreadRevealListeners = new Set<(spreadId: string) => void>()

/** Ask the pasteboard (windowed) to scroll a spread into view and make it active. */
export function requestSpreadReveal(spreadId: string): void {
  setActiveSpreadId(spreadId)
  for (const listener of spreadRevealListeners) {
    listener(spreadId)
  }
}

export function subscribeSpreadRevealRequest(
  listener: (spreadId: string) => void,
): () => void {
  spreadRevealListeners.add(listener)
  return () => {
    spreadRevealListeners.delete(listener)
  }
}

export function resetActiveSpreadIdForTests(): void {
  activeSpreadId = null
}

export interface PhotoRootSessionSnapshot {
  photoAccessPhase: PhotoAccessPhase
  photoFolderLabel: string | null
  hasPhotoFolder: boolean
}

type Listener = () => void

let photoAccessPhase: PhotoAccessPhase = 'idle'
let photoFolderLabel: string | null = null
let boundSourceRootId: string | null = null
const listeners = new Set<Listener>()

function buildPhotoRootSessionSnapshot(): PhotoRootSessionSnapshot {
  return {
    photoAccessPhase,
    photoFolderLabel,
    hasPhotoFolder: boundSourceRootId !== null || photoFolderLabel !== null,
  }
}

let snapshot: PhotoRootSessionSnapshot = buildPhotoRootSessionSnapshot()

function emit(): void {
  snapshot = buildPhotoRootSessionSnapshot()
  for (const listener of listeners) {
    listener()
  }
}

export function subscribePhotoRootSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPhotoRootSessionSnapshot(): PhotoRootSessionSnapshot {
  return snapshot
}

export function resetPhotoRootSessionForTests(): void {
  photoAccessPhase = 'idle'
  photoFolderLabel = null
  boundSourceRootId = null
  emit()
}

/** Test-only: drive the Allow access photo-folder control. */
export function setPhotoAccessPhaseForTests(
  phase: PhotoAccessPhase,
  label: string | null = 'Photos',
): void {
  photoAccessPhase = phase
  photoFolderLabel = label
  if (phase === 'permission-required') {
    boundSourceRootId = boundSourceRootId ?? 'root-test'
  }
  emit()
}

function bookKey(): string {
  return getBookStoreSnapshot().book.id
}

export function photoFolderActionLabel(hasFolder: boolean): string {
  return hasFolder ? 'Change photo folder…' : 'Choose photo folder…'
}

export function allowAccessPhotoFolderLabel(
  folderLabel: string | null,
): string {
  const name =
    folderLabel !== null && folderLabel !== '' ? folderLabel : 'folder'
  return `Allow access to ${name}`
}

function registerGrantedRoot(
  sourceRootId: string,
  handle: FileSystemDirectoryHandle,
  label?: string,
): void {
  const source = createFsaAssetSource({
    rootId: sourceRootId,
    directory: handle,
  })
  registerAssetSource(sourceRootId, source)
  boundSourceRootId = sourceRootId
  photoFolderLabel = label ?? handle.name
  photoAccessPhase = 'idle'
  emit()
}

/**
 * Bind a photo folder to the active book.
 * Pass `persist: false` to assign a sourceRootId in memory only (import first);
 * then call {@link persistBoundPhotoFolder} so IDB + FSA registration do not
 * contend with the import scroll window.
 * Pass `registerSource: false` (with persist) while import seeds a memory
 * AssetSource; call {@link registerBoundPhotoFolderSource} after import settles.
 */
export async function bindPhotoFolder(options: {
  directory: FileSystemDirectoryHandle
  replace?: boolean
  registerSource?: boolean
  persist?: boolean
}): Promise<{ sourceRootId: string }> {
  if (options.replace === true) {
    await clearBoundPhotoFolder({ clearGalleryAssets: true })
  }
  const sourceRootId = `root-${crypto.randomUUID()}`
  const label = options.directory.name

  if (options.persist === false) {
    // Assign id for import identity without emitting UI (Change label / FSA)
    // until persist — keeps the import scroll window comparable to pre-folder
    // setInputFiles library imports.
    boundSourceRootId = sourceRootId
    return { sourceRootId }
  }

  boundSourceRootId = sourceRootId
  photoFolderLabel = label
  photoAccessPhase = 'idle'
  await persistBoundPhotoFolder(sourceRootId, options.directory)
  if (options.registerSource === false) {
    emit()
    return { sourceRootId }
  }
  registerGrantedRoot(sourceRootId, options.directory, label)
  return { sourceRootId }
}

/** Write handle + book→root map to IDB after import (or when persist was skipped). */
export async function persistBoundPhotoFolder(
  sourceRootId: string,
  directory: FileSystemDirectoryHandle,
): Promise<void> {
  const remembered = await rememberSourceRootHandle(sourceRootId, directory)
  if (!remembered.ok) {
    throw new Error('Could not remember photo folder handle')
  }
  const binding: BookPhotoRoot = {
    sourceRootId,
    label: directory.name,
  }
  const set = await setBookPhotoRoot(bookKey(), binding)
  if (!set.ok) {
    throw new Error('Could not bind photo folder to book')
  }
  boundSourceRootId = sourceRootId
  photoFolderLabel = directory.name
  photoAccessPhase = 'idle'
  emit()
}

/** Register the durable FSA AssetSource after import seeding finishes. */
export function registerBoundPhotoFolderSource(
  sourceRootId: string,
  directory: FileSystemDirectoryHandle,
): void {
  registerGrantedRoot(sourceRootId, directory)
}

function clearGalleryAssetsForRoot(rootId: string): void {
  const { book } = getBookStoreSnapshot()
  const toRemove = book.gallery.filter(
    (assetId) => book.assets[assetId]?.sourceRootId === rootId,
  )
  removeFailedImportAssets(toRemove)
}

/**
 * Clear the prior photo folder binding (gallery + IDB). Call after Importing is
 * already painted so virtualizer teardown does not block progressive start.
 */
export function clearBoundPhotoFolderForReplace(): Promise<void> {
  return clearBoundPhotoFolder({ clearGalleryAssets: true })
}

async function clearBoundPhotoFolder(options?: {
  clearGalleryAssets?: boolean
}): Promise<void> {
  cancelFolderRescan()
  const bookId = bookKey()
  const memoryRootId = boundSourceRootId

  // Sync batch-clear from the in-memory root before any IDB await so
  // Change-folder progressive import is not blocked by handle recall.
  if (options?.clearGalleryAssets === true && memoryRootId !== null) {
    clearGalleryAssetsForRoot(memoryRootId)
  }

  // Drop memory binding before yielding so callers can assign a new root while
  // IDB deletes run. Do not null again after await — that would clobber rebind.
  if (memoryRootId !== null) {
    boundSourceRootId = null
    photoFolderLabel = null
    photoAccessPhase = 'idle'
    emit()
  }

  const existing = await getBookPhotoRoot(bookId)
  if (
    options?.clearGalleryAssets === true &&
    memoryRootId === null &&
    existing.ok
  ) {
    clearGalleryAssetsForRoot(existing.value.sourceRootId)
  }

  if (existing.ok) {
    await Promise.all([
      clearSourceRootHandle(existing.value.sourceRootId),
      clearSourceRootEntryIndex(existing.value.sourceRootId),
      clearBookPhotoRoot(bookId),
    ])
  } else if (memoryRootId !== null) {
    await Promise.all([
      clearSourceRootHandle(memoryRootId),
      clearSourceRootEntryIndex(memoryRootId),
    ])
  }

  if (boundSourceRootId === null) {
    photoFolderLabel = null
    photoAccessPhase = 'idle'
    emit()
  }
}

/**
 * After book activate / reload: restore handle, register when granted,
 * or mark permission-required for one-click re-grant.
 */
export async function restorePhotoFolderForActiveBook(): Promise<void> {
  const bookId = bookKey()
  const binding = await getBookPhotoRoot(bookId)
  if (!binding.ok) {
    const inferred = inferSourceRootFromAssets()
    if (inferred === null) {
      boundSourceRootId = null
      photoFolderLabel = null
      photoAccessPhase = 'idle'
      emit()
      return
    }
    await restoreBySourceRootId(inferred.sourceRootId, inferred.label)
    return
  }
  await restoreBySourceRootId(
    binding.value.sourceRootId,
    binding.value.label ?? null,
  )
}

function inferSourceRootFromAssets(): {
  sourceRootId: string
  label: string | null
} | null {
  const { book } = getBookStoreSnapshot()
  for (const assetId of book.gallery) {
    const rootId = book.assets[assetId]?.sourceRootId
    if (typeof rootId === 'string' && rootId !== '') {
      return { sourceRootId: rootId, label: null }
    }
  }
  return null
}

async function collectOtherBookAssets(
  sourceRootId: string,
): Promise<RescanAssetRef[]> {
  // Dynamic import avoids a static cycle with projectSession → photoRootSession.
  const { listLibraryBooks, loadLibraryBook } = await import('./projectSession')
  const openBookId = bookKey()
  const listed = await listLibraryBooks()
  if (!listed.ok) {
    return []
  }
  const refs: RescanAssetRef[] = []
  for (const summary of listed.value) {
    if (summary.id === openBookId) {
      continue
    }
    const loaded = await loadLibraryBook(summary.id)
    if (!loaded.ok) {
      continue
    }
    for (const [assetId, asset] of Object.entries(loaded.value.assets)) {
      const relativePath = asset.relativePath
      if (
        asset.sourceRootId !== sourceRootId ||
        typeof relativePath !== 'string' ||
        relativePath === ''
      ) {
        continue
      }
      const ref: RescanAssetRef = { assetId, relativePath }
      if (asset.byteSize !== undefined) {
        ref.byteSize = asset.byteSize
      }
      if (asset.mtimeMs !== undefined) {
        ref.mtimeMs = asset.mtimeMs
      }
      if (asset.contentHash !== undefined) {
        ref.contentHash = asset.contentHash
      }
      refs.push(ref)
    }
  }
  return refs
}

async function restoreBySourceRootId(
  sourceRootId: string,
  label: string | null,
): Promise<void> {
  boundSourceRootId = sourceRootId
  photoFolderLabel = label
  const recalled = await recallSourceRootHandle(sourceRootId)
  if (recalled.ok) {
    const directory = recalled.value as FileSystemDirectoryHandle
    registerGrantedRoot(sourceRootId, directory, label ?? undefined)
    const otherBookAssets = await collectOtherBookAssets(sourceRootId)
    await startFolderRescan({
      sourceRootId,
      directory,
      visibleSpreadId: getActiveSpreadId(),
      otherBookAssets,
      runLazy: true,
    })
    return
  }
  if (recalled.code === 'permission-required') {
    const peeked = await peekSourceRootHandle(sourceRootId)
    if (peeked.ok) {
      photoFolderLabel =
        label ?? (peeked.value as FileSystemDirectoryHandle).name
    }
    photoAccessPhase = 'permission-required'
    emit()
    return
  }
  photoAccessPhase = 'idle'
  emit()
}

/** One-click re-grant: requestPermission(read) on the stored handle. */
export async function regrantPhotoFolder(
  requestReadPermission: (
    handle: FileSystemDirectoryHandle,
  ) => Promise<'granted' | 'denied' | 'unavailable'>,
): Promise<'granted' | 'denied' | 'unavailable' | 'missing'> {
  const binding = await getBookPhotoRoot(bookKey())
  const resolvedId =
    boundSourceRootId ?? (binding.ok ? binding.value.sourceRootId : null)
  if (resolvedId === null) {
    return 'missing'
  }
  const peeked = await peekSourceRootHandle(resolvedId)
  if (!peeked.ok) {
    photoAccessPhase = 'idle'
    emit()
    return 'missing'
  }
  const handle = peeked.value as FileSystemDirectoryHandle
  const state = await requestReadPermission(handle)
  if (state === 'granted') {
    registerGrantedRoot(resolvedId, handle, photoFolderLabel ?? undefined)
    const otherBookAssets = await collectOtherBookAssets(resolvedId)
    await startFolderRescan({
      sourceRootId: resolvedId,
      directory: handle,
      visibleSpreadId: getActiveSpreadId(),
      otherBookAssets,
      runLazy: true,
    })
    return 'granted'
  }
  if (state === 'denied') {
    photoAccessPhase = 'idle'
    emit()
    return 'denied'
  }
  return state
}

export interface RescanAssetRef {
  assetId: string
  relativePath: string
  byteSize?: number
  mtimeMs?: number
  contentHash?: string
}

export interface PlanRescanPriorityInput {
  openBook: Book
  sourceRootId: string
  /** Active/visible spread; defaults to the first spread when null/missing. */
  visibleSpreadId: string | null
  /** Assets from other library books (already filtered or not). */
  otherBookAssets: readonly RescanAssetRef[]
}

function placedIdsOnSpread(spread: Spread | undefined): string[] {
  if (spread === undefined) {
    return []
  }
  const ids: string[] = []
  for (const frame of spread.frames) {
    if (frame.assetId !== undefined) {
      ids.push(frame.assetId)
    }
  }
  return ids
}

function refFromAsset(
  assetId: string,
  asset: Asset | undefined,
  sourceRootId: string,
): RescanAssetRef | null {
  const relativePath = asset?.relativePath
  if (
    asset?.sourceRootId !== sourceRootId ||
    typeof relativePath !== 'string' ||
    relativePath === ''
  ) {
    return null
  }
  const ref: RescanAssetRef = {
    assetId,
    relativePath,
  }
  if (asset.byteSize !== undefined) {
    ref.byteSize = asset.byteSize
  }
  if (asset.mtimeMs !== undefined) {
    ref.mtimeMs = asset.mtimeMs
  }
  if (asset.contentHash !== undefined) {
    ref.contentHash = asset.contentHash
  }
  return ref
}

/**
 * Pure priority order for post-reload verify / thumb320:
 * visible-spread placed → other open-book assets for root → other books.
 * Dedupes by relativePath (first wins).
 */
export function planRescanPriority(
  input: PlanRescanPriorityInput,
): RescanAssetRef[] {
  const { openBook, sourceRootId, otherBookAssets } = input
  const visibleId =
    input.visibleSpreadId !== null &&
    openBook.spreads.some((spread) => spread.id === input.visibleSpreadId)
      ? input.visibleSpreadId
      : (openBook.spreads[0]?.id ?? null)

  const seenPaths = new Set<string>()
  const ordered: RescanAssetRef[] = []

  const push = (ref: RescanAssetRef | null): void => {
    if (ref === null || seenPaths.has(ref.relativePath)) {
      return
    }
    seenPaths.add(ref.relativePath)
    ordered.push(ref)
  }

  const visibleSpread = openBook.spreads.find(
    (spread) => spread.id === visibleId,
  )
  for (const assetId of placedIdsOnSpread(visibleSpread)) {
    push(refFromAsset(assetId, openBook.assets[assetId], sourceRootId))
  }

  for (const assetId of openBook.gallery) {
    push(refFromAsset(assetId, openBook.assets[assetId], sourceRootId))
  }

  for (const spread of openBook.spreads) {
    for (const assetId of placedIdsOnSpread(spread)) {
      push(refFromAsset(assetId, openBook.assets[assetId], sourceRootId))
    }
  }

  for (const ref of otherBookAssets) {
    if (ref.relativePath === '') {
      continue
    }
    push(ref)
  }

  return ordered
}

/**
 * Paths in `scanned` that are not in the prioritized used-in-book set.
 * Reversed so lazy work does not follow directory enumeration order.
 */
export function remainingScannedPaths(
  scannedRelativePaths: readonly string[],
  prioritized: readonly RescanAssetRef[],
): string[] {
  const used = new Set(prioritized.map((ref) => ref.relativePath))
  const rest: string[] = []
  for (const path of scannedRelativePaths) {
    if (!used.has(path)) {
      rest.push(path)
    }
  }
  return rest.reverse()
}

export interface FolderRescanProgress {
  total: number
  completed: number
  running: boolean
  phase: 'priority' | 'lazy'
}

type ProgressListener = (state: FolderRescanProgress | null) => void

let progress: FolderRescanProgress | null = null
const progressListeners = new Set<ProgressListener>()
let cancelEpoch = 0
let activeRun: Promise<void> | null = null

function emitProgress(next: FolderRescanProgress | null): void {
  progress = next
  for (const listener of progressListeners) {
    listener(progress)
  }
}

export function subscribeFolderRescanProgress(
  listener: ProgressListener,
): () => void {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

export function getFolderRescanProgress(): FolderRescanProgress | null {
  return progress
}

export function cancelFolderRescan(): void {
  cancelEpoch += 1
}

export function resetFolderRescanForTests(): void {
  cancelFolderRescan()
  activeRun = null
  emitProgress(null)
}

export function setFolderRescanProgressForTests(
  state: FolderRescanProgress | null,
): void {
  emitProgress(state)
}

function assetRecordFor(ref: RescanAssetRef): Asset {
  const existing = getBookStoreSnapshot().book.assets[ref.assetId]
  if (existing !== undefined) {
    return existing
  }
  return {
    relativePath: ref.relativePath,
    ...(ref.byteSize !== undefined ? { byteSize: ref.byteSize } : {}),
    ...(ref.mtimeMs !== undefined ? { mtimeMs: ref.mtimeMs } : {}),
    ...(ref.contentHash !== undefined ? { contentHash: ref.contentHash } : {}),
  }
}

async function verifyRef(
  sourceRootId: string,
  source: AssetSource,
  ref: RescanAssetRef,
  scannedByPath: ReadonlyMap<string, ScannedEntry>,
): Promise<void> {
  const scanned = scannedByPath.get(ref.relativePath)
  const prev = assetRecordFor(ref)
  const identityMatches =
    scanned !== undefined &&
    prev.byteSize === scanned.byteSize &&
    prev.mtimeMs === scanned.mtimeMs
  // Size+mtime match (and changed/missing scan meta): reattach a live File via
  // resolveFile / getFile only. Never call readForHash / file.arrayBuffer() /
  // new File([buffer]) on this priority path — body reads belong to decode /
  // import.
  const resolved = await source.resolveFile(sourceRootId, ref.relativePath)
  if (!resolved.ok) {
    return
  }
  retainAssetSource(ref.assetId, resolved.value)
  // Patch identity from the cheap scan when present (no content-hash).
  // Size/mtime change ⇒ new identity cache key; clear legacy contentHash field.
  if (scanned !== undefined) {
    const metaChanged = !identityMatches
    patchAssetRecord(ref.assetId, {
      sourceRootId,
      relativePath: scanned.relativePath,
      byteSize: scanned.byteSize,
      mtimeMs: scanned.mtimeMs,
      ...(metaChanged ? { contentHash: undefined } : {}),
    })
  }
}

/**
 * After granted restore: always cheap-walk, list-first placeholders, verify
 * used-in-book by path/size/mtime, then continue importing missing gallery
 * paths. Resolves after the priority phase; remainder import continues in
 * background. No content-hash on this hot path.
 */
export async function startFolderRescan(options: {
  sourceRootId: string
  /** Required to continue importing missing gallery entries after reload. */
  directory?: AssetDirectoryHandle | FileSystemDirectoryHandle
  visibleSpreadId?: string | null
  otherBookAssets?: readonly RescanAssetRef[]
  runLazy?: boolean
}): Promise<void> {
  cancelFolderRescan()
  const runEpoch = cancelEpoch
  const isCancelled = (): boolean => cancelEpoch !== runEpoch

  const run = (async () => {
    const source = getRegisteredAssetSource(options.sourceRootId)
    if (source === undefined) {
      emitProgress(null)
      return
    }
    // Manifest-first: paint slots + identity thumbs before the walk finishes.
    const prior = await getSourceRootEntryIndex(options.sourceRootId)
    const priorManifest = prior.ok ? prior.value : null
    if (priorManifest !== null) {
      enqueueManifestGalleryList(options.sourceRootId, priorManifest.entries, {
        markImportRunning: false,
      })
      await yieldForPaint()
    }
    // Always cheap full walk — never skip via count/max-mtime/manifest.
    const scannedResult = await source.scanRoot(options.sourceRootId)
    if (!scannedResult.ok) {
      emitProgress(null)
      return
    }
    const scanned = scannedResult.value
    const indexDiff = diffEntryIndex(priorManifest, scanned)
    // Re-read IDB inside persist so mid-session dim patches are not dropped.
    await persistScannedEntryIndex(options.sourceRootId, scanned, {
      yieldFn: yieldForPaint,
    })

    const scannedByPath = new Map(
      scanned.map((entry) => [entry.relativePath, entry] as const),
    )
    // List-first: placeholders for accepted images not yet in gallery.
    // Omit size/mtime-changed paths so stale manifest dims do not stick.
    const changedPathSet = new Set(indexDiff.changedPaths)
    const dimsByPath =
      priorManifest === null
        ? null
        : new Map(
            Object.entries(priorManifest.entries).filter(
              ([path]) => !changedPathSet.has(path),
            ),
          )
    enqueueScannedGalleryList(options.sourceRootId, scanned, {
      markImportRunning: false,
      dimsByPath,
    })
    // Finish list-first gallery writes before priority planning so newly
    // enqueued placeholders are not misclassified into lazy "Scanning folder".
    await awaitPendingGalleryFlush(yieldForPaint)
    if (changedPathSet.size > 0) {
      const { book, sessionMeta } = getBookStoreSnapshot()
      for (const assetId of book.gallery) {
        const path = book.assets[assetId]?.relativePath
        if (typeof path !== 'string' || !changedPathSet.has(path)) {
          continue
        }
        const meta = sessionMeta.get(assetId)
        if (meta === undefined) {
          continue
        }
        setAssetSessionMeta(assetId, {
          ...meta,
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        })
      }
    }
    // Drop gallery tiles whose paths disappeared from disk (keep placed).
    if (indexDiff.removedPaths.length > 0) {
      const { book } = getBookStoreSnapshot()
      const placedCounts = placementCountByAsset(book)
      const removedSet = new Set(indexDiff.removedPaths)
      const toRemove = book.gallery.filter((assetId) => {
        if ((placedCounts.get(assetId) ?? 0) > 0) {
          return false
        }
        const path = book.assets[assetId]?.relativePath
        return typeof path === 'string' && removedSet.has(path)
      })
      if (toRemove.length > 0) {
        removeFailedImportAssets(toRemove)
      }
    }

    const book = getBookStoreSnapshot().book
    const prioritized = planRescanPriority({
      openBook: book,
      sourceRootId: options.sourceRootId,
      visibleSpreadId: options.visibleSpreadId ?? book.spreads[0]?.id ?? null,
      otherBookAssets: options.otherBookAssets ?? [],
    })
    // Prefer re-verify for metadata-changed paths even when already in gallery.
    const priorityWithChanges = [...prioritized]
    for (const path of indexDiff.changedPaths) {
      if (priorityWithChanges.some((ref) => ref.relativePath === path)) {
        continue
      }
      const assetId = book.gallery.find(
        (id) => book.assets[id]?.relativePath === path,
      )
      if (assetId === undefined) {
        continue
      }
      priorityWithChanges.push({ assetId, relativePath: path })
    }
    const lazyPaths = remainingScannedPaths(
      scanned
        .filter((entry) => isAcceptedPhotoPath(entry.relativePath))
        .map((entry) => entry.relativePath),
      priorityWithChanges,
    )
    // New paths (not in gallery before list-enqueue) + non-priority remainder.
    const missingEntries = [
      ...indexDiff.newPaths.flatMap((path) => {
        if (!isAcceptedPhotoPath(path) || changedPathSet.has(path)) {
          return []
        }
        if (priorityWithChanges.some((ref) => ref.relativePath === path)) {
          return []
        }
        const entry = scannedByPath.get(path)
        return entry === undefined ? [] : [entry]
      }),
      ...lazyPaths.flatMap((path) => {
        if (indexDiff.newPaths.includes(path)) {
          return []
        }
        const entry = scannedByPath.get(path)
        return entry === undefined ? [] : [entry]
      }),
    ]
    const prioritizedRefs = priorityWithChanges
    const runLazy = options.runLazy !== false
    const total = prioritizedRefs.length + (runLazy ? missingEntries.length : 0)
    let completed = 0
    emitProgress({
      total: Math.max(total, 1),
      completed: 0,
      running: true,
      phase: 'priority',
    })

    const progressRaf = { id: null as number | null }
    const flushPriorityProgress = (): void => {
      if (progressRaf.id !== null) {
        cancelAnimationFrame(progressRaf.id)
        progressRaf.id = null
      }
      emitProgress({
        total: Math.max(total, 1),
        completed,
        running: true,
        phase: 'priority',
      })
    }
    const schedulePriorityProgress = (): void => {
      if (progressRaf.id !== null) {
        return
      }
      progressRaf.id = requestAnimationFrame(() => {
        progressRaf.id = null
        if (!isCancelled()) {
          emitProgress({
            total: Math.max(total, 1),
            completed,
            running: true,
            phase: 'priority',
          })
        }
      })
    }

    await mapWithConcurrency(
      prioritizedRefs,
      IMPORT_BODY_READ_CAP,
      async (ref) => {
        if (isCancelled()) {
          return
        }
        await verifyRef(options.sourceRootId, source, ref, scannedByPath)
        completed += 1
        schedulePriorityProgress()
        if (completed % IMPORT_BODY_READ_CAP === 0) {
          await yieldForPaint()
        }
      },
    )
    if (isCancelled()) {
      if (progressRaf.id !== null) {
        cancelAnimationFrame(progressRaf.id)
        progressRaf.id = null
      }
      emitProgress(null)
      return
    }
    flushPriorityProgress()

    if (!runLazy || missingEntries.length === 0 || isCancelled()) {
      emitProgress(null)
      return
    }

    emitProgress({
      total: Math.max(total, 1),
      completed,
      running: true,
      phase: 'lazy',
    })

    const directory = options.directory
    const lazy = (async () => {
      if (directory !== undefined && missingEntries.length > 0) {
        await importScannedEntriesInBatches(directory, missingEntries, {
          sourceRootId: options.sourceRootId,
          libraryBacked: true,
          listAlreadyEnqueued: true,
          onProgress: (progress) => {
            if (progress === null) {
              emitProgress(null)
              return
            }
            emitProgress({
              total: Math.max(total, 1),
              completed: Math.min(
                total,
                prioritizedRefs.length + progress.completed,
              ),
              running: progress.running,
              phase: 'lazy',
            })
          },
          onErrors: () => undefined,
        })
        if (!isCancelled()) {
          emitProgress(null)
        }
        return
      }
      // No directory: leave idle placeholders (no body/hash warm).
      emitProgress(null)
    })()
    activeRun = lazy.finally(() => {
      if (activeRun === lazy) {
        activeRun = null
      }
    })
  })()

  activeRun = run
  try {
    await run
  } finally {
    if (activeRun === run) {
      activeRun = null
    }
  }
}

export async function awaitFolderRescanForTests(): Promise<void> {
  if (activeRun !== null) {
    await activeRun
  }
}

const FOLDER_IMPORT_BATCH_SIZE = IMPORT_BODY_READ_CAP

export interface FolderImportBatchOptions {
  sourceRootId: string
  libraryBacked?: boolean
  /** Placeholders already enqueued from the cheap scan. */
  listAlreadyEnqueued?: boolean
  onProgress: (progress: ImportProgress | null) => void
  onErrors: (errors: readonly ImportFileError[]) => void
  /** After the first batch yields — e.g. persist photo-root IDB early. */
  onFirstBatchYielded?: () => void | Promise<void>
}

function toImportResult(result: {
  imported: number
  skipped: number
  errors: readonly ImportFileError[]
}): ImportPhotoResult {
  return {
    imported: result.imported,
    skipped: result.skipped,
    errors: [...result.errors],
  }
}

/**
 * Import already-resolved Files in one progressive `importPhotoFiles` call
 * (used when the caller already has a File list, e.g. e2e input seam).
 */
export async function importFilesInBatches(
  files: readonly File[],
  options: FolderImportBatchOptions,
): Promise<ImportPhotoResult> {
  if (files.length === 0) {
    return { imported: 0, errors: [], skipped: 0 }
  }
  const result = await runChromeImport(files, {
    source: 'folder',
    sourceRootId: options.sourceRootId,
    ...(options.libraryBacked !== undefined
      ? { libraryBacked: options.libraryBacked }
      : {}),
    ...(options.listAlreadyEnqueued === true
      ? { listAlreadyEnqueued: true }
      : {}),
    onProgress: options.onProgress,
    onErrors: options.onErrors,
  })
  await yieldForPaint()
  await options.onFirstBatchYielded?.()
  return toImportResult(result)
}

/**
 * Resolve + import per capped batch so progressive decode starts before the
 * whole tree is materialized as File handles.
 */
export async function importScannedEntriesInBatches(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
  entries: readonly ScannedEntry[],
  options: FolderImportBatchOptions,
): Promise<ImportPhotoResult> {
  if (entries.length === 0) {
    return { imported: 0, errors: [], skipped: 0 }
  }
  options.onProgress({
    total: entries.length,
    completed: 0,
    errors: [],
    running: true,
  })
  // Hold importRunning for the whole multi-wave import so list-first
  // placeholders are not treated as missing between importPhotoFiles calls.
  setImportRunning(true, entries.length)
  let imported = 0
  let skipped = 0
  const errors: ImportFileError[] = []
  let awaitPriorHashes = true
  let resolvedAny = false
  let firstBatchYielded = false
  try {
    for (
      let offset = 0;
      offset < entries.length;
      offset += FOLDER_IMPORT_BATCH_SIZE
    ) {
      const slice = entries.slice(offset, offset + FOLDER_IMPORT_BATCH_SIZE)
      const files: File[] = []
      for (const entry of slice) {
        const file = await resolveRelativeFile(directory, entry.relativePath)
        if (file !== null) {
          files.push(file)
        }
      }
      options.onProgress({
        total: entries.length,
        completed: Math.min(entries.length, offset + slice.length),
        errors: [...errors],
        running: true,
      })
      if (files.length > 0) {
        resolvedAny = true
        const result = await runChromeImport(files, {
          source: 'folder',
          sourceRootId: options.sourceRootId,
          ...(options.libraryBacked !== undefined
            ? { libraryBacked: options.libraryBacked }
            : {}),
          ...(options.listAlreadyEnqueued === true
            ? { listAlreadyEnqueued: true }
            : {}),
          manageImportRunning: false,
          awaitPriorHashes,
          onProgress: (progress) => {
            if (progress === null) {
              const moreBatches =
                offset + FOLDER_IMPORT_BATCH_SIZE < entries.length
              if (!moreBatches) {
                options.onProgress(null)
              }
              return
            }
            options.onProgress({
              total: entries.length,
              completed: Math.min(
                entries.length,
                offset + Math.max(progress.completed, 1),
              ),
              errors: [...errors, ...progress.errors],
              running: true,
            })
          },
          onErrors: (batchErrors) => {
            errors.push(...batchErrors)
            options.onErrors(batchErrors)
          },
        })
        imported += result.imported
        skipped += result.skipped
        awaitPriorHashes = false
      }
      await yieldForPaint()
      if (!firstBatchYielded) {
        firstBatchYielded = true
        await options.onFirstBatchYielded?.()
      }
    }
  } finally {
    setImportRunning(false)
  }
  if (!resolvedAny) {
    options.onProgress(null)
    return { imported: 0, errors: [], skipped: 0 }
  }
  if (errors.length === 0) {
    options.onProgress(null)
  } else {
    options.onProgress({
      total: entries.length,
      completed: entries.length,
      errors: [...errors],
      running: false,
    })
  }
  return { imported, skipped, errors: [...errors] }
}
