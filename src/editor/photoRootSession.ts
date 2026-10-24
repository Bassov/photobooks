import { createFsaAssetSource } from '../assets'
import { retainAssetSource } from '../photo/assetSources'
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
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'
import { getBookStoreSnapshot, removeFailedImportAssets } from './bookStore'

export type PhotoAccessPhase = 'idle' | 'permission-required'

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
      clearBookPhotoRoot(bookId),
    ])
  } else if (memoryRootId !== null) {
    await clearSourceRootHandle(memoryRootId)
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

async function restoreBySourceRootId(
  sourceRootId: string,
  label: string | null,
): Promise<void> {
  boundSourceRootId = sourceRootId
  photoFolderLabel = label
  const recalled = await recallSourceRootHandle(sourceRootId)
  if (recalled.ok) {
    registerGrantedRoot(
      sourceRootId,
      recalled.value as FileSystemDirectoryHandle,
      label ?? undefined,
    )
    await rehydrateSessionFilesFromRoot(sourceRootId)
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
    await rehydrateSessionFilesFromRoot(resolvedId)
    return 'granted'
  }
  if (state === 'denied') {
    photoAccessPhase = 'idle'
    emit()
    return 'denied'
  }
  return state
}

async function rehydrateSessionFilesFromRoot(
  sourceRootId: string,
): Promise<void> {
  const source = getRegisteredAssetSource(sourceRootId)
  if (source === undefined) {
    return
  }
  const { book } = getBookStoreSnapshot()
  for (const assetId of book.gallery) {
    const asset = book.assets[assetId]
    if (
      asset?.sourceRootId !== sourceRootId ||
      typeof asset.relativePath !== 'string'
    ) {
      continue
    }
    const read = await source.readForHash(sourceRootId, asset.relativePath)
    if (!read.ok) {
      continue
    }
    const name = asset.relativePath.split('/').pop() ?? asset.relativePath
    const file = new File([read.value], name, {
      lastModified: asset.mtimeMs ?? Date.now(),
    })
    retainAssetSource(assetId, file)
  }
}
