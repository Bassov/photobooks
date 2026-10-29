import { TEST_FIXTURES_FLAG } from '../../lib/testFixturesBuild'
import type { StorageFailure, StorageResult } from '../types'
import {
  createBookPhotoRootIdb,
  createSourceRootIdb,
  type SessionIdb,
} from './idb'
import type { SessionDirectoryHandle } from './types'

export interface BookPhotoRoot {
  sourceRootId: string
  label?: string
}

export interface BrowserSourceRootHandlesOptions {
  sourceRootIdb?: SessionIdb
  bookPhotoRootIdb?: SessionIdb
}

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function isFileSystemHandle(
  value: unknown,
): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as FileSystemHandle).kind === 'directory'
  )
}

async function hasReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') {
    return true
  }
  const state = await handle.queryPermission({ mode: 'read' })
  return state === 'granted'
}

function parseBookPhotoRoot(value: unknown): BookPhotoRoot | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.sourceRootId !== 'string' || record.sourceRootId === '') {
    return null
  }
  const binding: BookPhotoRoot = { sourceRootId: record.sourceRootId }
  if (typeof record.label === 'string') {
    binding.label = record.label
  }
  return binding
}

function resolveSourceRootIdb(
  options?: BrowserSourceRootHandlesOptions,
): SessionIdb {
  return options?.sourceRootIdb ?? createSourceRootIdb()
}

function resolveBookPhotoRootIdb(
  options?: BrowserSourceRootHandlesOptions,
): SessionIdb {
  return options?.bookPhotoRootIdb ?? createBookPhotoRootIdb()
}

/** Playwright directory-picker doubles are not structured-cloneable into IDB. */
const e2eSourceRootMemory = new Map<string, SessionDirectoryHandle>()

async function readStoredHandle(
  idb: SessionIdb,
  sourceRootId: string,
): Promise<StorageResult<SessionDirectoryHandle>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  if (TEST_FIXTURES_FLAG) {
    const memory = e2eSourceRootMemory.get(sourceRootId)
    if (memory !== undefined) {
      return success(memory)
    }
  }
  const stored = await idb.get(sourceRootId)
  if (!stored.present) {
    return failure('not-found')
  }
  if (!isFileSystemHandle(stored.value)) {
    return failure('not-found')
  }
  return success(stored.value)
}

export async function rememberSourceRootHandle(
  sourceRootId: string,
  handle: SessionDirectoryHandle,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<void>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  try {
    const idb = resolveSourceRootIdb(options)
    await idb.set(sourceRootId, handle)
    // Keep a live handle in e2e: Playwright picker doubles are often
    // structured-cloneable into IDB but lose methods on round-trip.
    if (TEST_FIXTURES_FLAG) {
      e2eSourceRootMemory.set(sourceRootId, handle)
    } else {
      e2eSourceRootMemory.delete(sourceRootId)
    }
    return success(undefined)
  } catch {
    if (TEST_FIXTURES_FLAG) {
      e2eSourceRootMemory.set(sourceRootId, handle)
      return success(undefined)
    }
    return failure('not-found')
  }
}

/** Opaque stored handle without requiring read permission. */
export async function peekSourceRootHandle(
  sourceRootId: string,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<SessionDirectoryHandle>> {
  try {
    return await readStoredHandle(resolveSourceRootIdb(options), sourceRootId)
  } catch {
    return failure('not-found')
  }
}

export async function recallSourceRootHandle(
  sourceRootId: string,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<SessionDirectoryHandle>> {
  try {
    const peeked = await readStoredHandle(
      resolveSourceRootIdb(options),
      sourceRootId,
    )
    if (!peeked.ok) {
      return peeked
    }
    if (!(await hasReadPermission(peeked.value as FileSystemDirectoryHandle))) {
      return failure('permission-required')
    }
    return peeked
  } catch {
    return failure('not-found')
  }
}

export async function clearSourceRootHandle(
  sourceRootId: string,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<void>> {
  if (sourceRootId === '') {
    return failure('not-found')
  }
  const hadMemory = e2eSourceRootMemory.delete(sourceRootId)
  try {
    const idb = resolveSourceRootIdb(options)
    const stored = await idb.get(sourceRootId)
    if (!stored.present) {
      return hadMemory ? success(undefined) : failure('not-found')
    }
    await idb.del(sourceRootId)
    return success(undefined)
  } catch {
    return hadMemory ? success(undefined) : failure('not-found')
  }
}

export async function setBookPhotoRoot(
  bookId: string,
  binding: BookPhotoRoot,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<void>> {
  if (bookId === '' || binding.sourceRootId === '') {
    return failure('not-found')
  }
  try {
    const value: BookPhotoRoot = { sourceRootId: binding.sourceRootId }
    if (binding.label !== undefined) {
      value.label = binding.label
    }
    await resolveBookPhotoRootIdb(options).set(bookId, value)
    return success(undefined)
  } catch {
    return failure('not-found')
  }
}

export async function getBookPhotoRoot(
  bookId: string,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<BookPhotoRoot>> {
  if (bookId === '') {
    return failure('not-found')
  }
  try {
    const stored = await resolveBookPhotoRootIdb(options).get(bookId)
    if (!stored.present) {
      return failure('not-found')
    }
    const parsed = parseBookPhotoRoot(stored.value)
    if (parsed === null) {
      return failure('not-found')
    }
    return success(parsed)
  } catch {
    return failure('not-found')
  }
}

export async function clearBookPhotoRoot(
  bookId: string,
  options?: BrowserSourceRootHandlesOptions,
): Promise<StorageResult<void>> {
  if (bookId === '') {
    return failure('not-found')
  }
  try {
    const idb = resolveBookPhotoRootIdb(options)
    const stored = await idb.get(bookId)
    if (!stored.present) {
      return failure('not-found')
    }
    await idb.del(bookId)
    return success(undefined)
  } catch {
    return failure('not-found')
  }
}
