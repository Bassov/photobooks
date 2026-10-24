import { describe, expect, it } from 'vitest'

import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
  parseLibraryLabel,
  parseRecents,
} from './libraryLabel'

describe('libraryLabel helpers', () => {
  it('treats __-prefixed keys as reserved', () => {
    expect(isReservedSessionKey('__recents')).toBe(true)
    expect(isReservedSessionKey('__active')).toBe(true)
    expect(isReservedSessionKey('library')).toBe(false)
  })

  it('prefers explicit label, then handle name, then id', () => {
    expect(labelForHandle('library', {}, '  Trip  ')).toBe('Trip')
    expect(labelForHandle('library', { name: 'Photos' }, undefined)).toBe(
      'Photos',
    )
    expect(labelForHandle('library', { name: '  ' }, undefined)).toBe('Library')
    expect(
      labelForHandle('library', { name: 1 as unknown as string }, undefined),
    ).toBe('Library')
    expect(labelForHandle('library', {}, undefined)).toBe('Library')
    expect(labelForHandle('other', {}, undefined)).toBe('other')
    expect(labelForHandle('library', {}, '')).toBe('Library')
  })

  it('parses active ids and labels', () => {
    expect(parseActiveIds(null)).toEqual({ libraryId: null, bookId: null })
    expect(parseActiveIds(undefined)).toEqual({ libraryId: null, bookId: null })
    expect(parseActiveIds('x')).toEqual({ libraryId: null, bookId: null })
    expect(parseActiveIds({ libraryId: 'library', bookId: 'b1' })).toEqual({
      libraryId: 'library',
      bookId: 'b1',
    })
    expect(parseActiveIds({ libraryId: 1, bookId: 'b1' })).toEqual({
      libraryId: null,
      bookId: 'b1',
    })
    expect(parseActiveIds({ libraryId: 'library', bookId: 2 })).toEqual({
      libraryId: 'library',
      bookId: null,
    })
    expect(parseLibraryLabel('  Trip  ')).toBe('Trip')
    expect(parseLibraryLabel('')).toBeNull()
    expect(parseLibraryLabel('   ')).toBeNull()
    expect(parseLibraryLabel(1)).toBeNull()
  })

  it('parses legacy recents for migration', () => {
    expect(parseRecents(null)).toEqual([])
    expect(parseRecents({})).toEqual([])
    expect(
      parseRecents([
        { id: 'a', label: 'A' },
        null,
        { id: 1, label: 'bad' },
        { id: 'b', label: 'B' },
        { id: 'c' },
        'skip',
      ]),
    ).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ])
  })
})
