import type {
  RecentLibrary,
  SessionActiveIds,
  SessionDirectoryHandle,
} from './types'

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
  return libraryId === 'library' ? 'Library' : libraryId
}

const MAX_RECENT_LIBRARIES = 10

export function upsertRecentFront(
  current: readonly RecentLibrary[],
  entry: RecentLibrary,
  max = MAX_RECENT_LIBRARIES,
): RecentLibrary[] {
  const without = current.filter((item) => item.id !== entry.id)
  return [entry, ...without].slice(0, max)
}

export function removeRecent(
  current: readonly RecentLibrary[],
  libraryId: string,
): RecentLibrary[] {
  return current.filter((item) => item.id !== libraryId)
}

export function parseRecents(value: unknown): RecentLibrary[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: RecentLibrary[] = []
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

export function parseActiveIds(value: unknown): SessionActiveIds {
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
