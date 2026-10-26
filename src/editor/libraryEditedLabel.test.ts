import { describe, expect, it } from 'vitest'

import {
  formatLibraryBookMeta,
  formatLibraryEditedLabel,
} from './libraryEditedLabel'

describe('formatLibraryEditedLabel', () => {
  const now = Date.UTC(2026, 9, 26, 12, 0, 0)

  it('formats recent relative spans', () => {
    expect(formatLibraryEditedLabel(now - 30_000, now)).toBe('just now')
    expect(formatLibraryEditedLabel(now - 60_000, now)).toBe('1 minute ago')
    expect(formatLibraryEditedLabel(now - 5 * 60_000, now)).toBe(
      '5 minutes ago',
    )
    expect(formatLibraryEditedLabel(now - 3_600_000, now)).toBe('1 hour ago')
    expect(formatLibraryEditedLabel(now - 5 * 3_600_000, now)).toBe(
      '5 hours ago',
    )
    expect(formatLibraryEditedLabel(now - 86_400_000, now)).toBe('yesterday')
  })

  it('falls back to a short calendar date', () => {
    expect(formatLibraryEditedLabel(Date.UTC(2026, 9, 18), now)).toMatch(
      /Oct 18/,
    )
  })
})

describe('formatLibraryBookMeta', () => {
  it('omits edited when mtime is unknown', () => {
    expect(formatLibraryBookMeta(6, undefined)).toBe('6 pages')
  })

  it('includes edited when mtime is known', () => {
    const now = Date.UTC(2026, 9, 26, 12, 0, 0)
    expect(formatLibraryBookMeta(6, now - 7_200_000, now)).toBe(
      '6 pages · edited 2 hours ago',
    )
  })
})
