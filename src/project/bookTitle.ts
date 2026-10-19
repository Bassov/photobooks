/** Title for listings; missing or non-string document title → "". */
export function bookTitleFromUnknown(raw: unknown): string {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return ''
  }
  if (!('title' in raw)) {
    return ''
  }
  return typeof raw.title === 'string' ? raw.title : ''
}

/** UI label; empty/whitespace/missing → "Untitled book". Never write this into storage. */
export function displayBookTitle(title: string | undefined): string {
  if (title === undefined) {
    return 'Untitled book'
  }
  const trimmed = title.trim()
  return trimmed === '' ? 'Untitled book' : trimmed
}

/** Normalize a user-entered title for storage (trim; whitespace-only → ""). */
export function normalizeBookTitleInput(raw: string): string {
  return raw.trim()
}
