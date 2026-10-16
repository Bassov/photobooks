import { describe, expect, it } from 'vitest'
import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
  parseRecents,
  removeRecent,
  upsertRecentFront,
} from './recents'

describe('session recents helpers', () => {
  it('detects reserved session keys', () => {
    expect(isReservedSessionKey('__recents')).toBe(true)
    expect(isReservedSessionKey('__active')).toBe(true)
    expect(isReservedSessionKey('library')).toBe(false)
    expect(isReservedSessionKey('abc')).toBe(false)
  })

  it('prefers explicit label over handle name', () => {
    expect(labelForHandle('id-1', { name: 'Folder' }, ' Explicit ')).toBe(
      'Explicit',
    )
  })

  it('uses handle name when label is missing', () => {
    expect(labelForHandle('id-1', { name: ' Photos ' })).toBe('Photos')
  })

  it('falls back to Library for the legacy library id', () => {
    expect(labelForHandle('library', {})).toBe('Library')
    expect(labelForHandle('other', {})).toBe('other')
  })

  it('ignores blank handle names', () => {
    expect(labelForHandle('id-1', { name: '   ' })).toBe('id-1')
  })

  it('moves a remembered library to the front', () => {
    const next = upsertRecentFront(
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      { id: 'b', label: 'Beta' },
    )
    expect(next).toEqual([
      { id: 'b', label: 'Beta' },
      { id: 'a', label: 'A' },
    ])
  })

  it('removes a library from recents', () => {
    expect(
      removeRecent(
        [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        'a',
      ),
    ).toEqual([{ id: 'b', label: 'B' }])
  })

  it('parses only well-formed recent entries', () => {
    expect(parseRecents(null)).toEqual([])
    expect(parseRecents([{ id: 'a', label: 'A' }, { id: 1 }, 'x'])).toEqual([
      { id: 'a', label: 'A' },
    ])
  })

  it('parses active ids with missing values', () => {
    expect(parseActiveIds(undefined)).toEqual({
      libraryId: null,
      bookId: null,
    })
    expect(parseActiveIds({ libraryId: 'lib', bookId: 'book' })).toEqual({
      libraryId: 'lib',
      bookId: 'book',
    })
    expect(parseActiveIds({ libraryId: 'lib', bookId: 1 })).toEqual({
      libraryId: 'lib',
      bookId: null,
    })
  })
})
