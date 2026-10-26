import { describe, expect, it } from 'vitest'

import { shouldSkipLibraryRename } from './libraryRename'

describe('shouldSkipLibraryRename', () => {
  it('skips when titles match', () => {
    expect(shouldSkipLibraryRename('Trip', 'Trip')).toBe(true)
  })

  it('does not skip when titles differ or current is missing', () => {
    expect(shouldSkipLibraryRename('Trip', 'Home')).toBe(false)
    expect(shouldSkipLibraryRename(undefined, '')).toBe(false)
  })
})
