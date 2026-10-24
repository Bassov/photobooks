import type { SessionDirectoryHandle } from './types'
import { DEFAULT_LIBRARY_ID } from './types'

export const LABEL_KEY = '__libraryLabel'
/** Legacy ordered recents key — migrated away on browser open. */
export const RECENTS_KEY = '__recents'
export const ACTIVE_KEY = '__active'

export function isReservedSessionKey(key: string): boolean {
  return key.startsWith('__')
}

export function labelForHandle(
  libraryId: string,
  handle: SessionDirectoryHandle,
  label?: string,
): string {
  const trimmed = label?.trim()
  if (trimmed) {
    return trimmed
  }
  if ('name' in handle && typeof handle.name === 'string') {
    const name = handle.name.trim()
    if (name.length > 0) {
      return name
    }
  }
  return libraryId === DEFAULT_LIBRARY_ID ? 'Library' : libraryId
}

export function parseActiveIds(value: unknown): {
  libraryId: string | null
  bookId: string | null
} {
  if (typeof value !== 'object' || value === null) {
    return { libraryId: null, bookId: null }
  }
  const libraryId =
    'libraryId' in value && typeof value.libraryId === 'string'
      ? value.libraryId
      : null
  const bookId =
    'bookId' in value && typeof value.bookId === 'string' ? value.bookId : null
  return { libraryId, bookId }
}

export function parseLibraryLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export interface LegacyRecentEntry {
  id: string
  label: string
}

export function parseRecents(value: unknown): LegacyRecentEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: LegacyRecentEntry[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const record = item as Record<string, unknown>
    const id = record.id
    const label = record.label
    if (typeof id !== 'string' || typeof label !== 'string') {
      continue
    }
    result.push({ id, label })
  }
  return result
}
