import { describe, expect, it } from 'vitest'

import {
  filterAndSortLibraryBooks,
  toLibraryGridBook,
  type LibraryGridBook,
} from './libraryBookFilter'

const sample: LibraryGridBook[] = [
  {
    id: 'a',
    title: 'Zulu',
    displayTitle: 'Zulu',
    fmt: 'portrait',
    spreads: 2,
  },
  {
    id: 'b',
    title: 'Alpha',
    displayTitle: 'Alpha',
    fmt: 'landscape',
    spreads: 3,
  },
  {
    id: 'c',
    title: '',
    displayTitle: 'Untitled book',
    fmt: 'square',
    spreads: 1,
  },
]

describe('toLibraryGridBook', () => {
  it('maps trim to format and empty title to Untitled book', () => {
    expect(
      toLibraryGridBook({
        id: '1',
        title: '',
        spreadCount: 4,
        pageWidthMm: 250,
        pageHeightMm: 200,
      }),
    ).toEqual({
      id: '1',
      title: '',
      displayTitle: 'Untitled book',
      fmt: 'landscape',
      spreads: 4,
    })
  })

  it('defaults missing trim and spread count', () => {
    expect(toLibraryGridBook({ id: '2', title: 'X' })).toEqual({
      id: '2',
      title: 'X',
      displayTitle: 'X',
      fmt: 'square',
      spreads: 0,
    })
  })
})

describe('filterAndSortLibraryBooks', () => {
  it('filters by display title', () => {
    expect(filterAndSortLibraryBooks(sample, 'alp', 'edited')).toEqual([
      sample[1],
    ])
  })

  it('filters case-insensitively with trim', () => {
    expect(filterAndSortLibraryBooks(sample, '  ZULU  ', 'edited')).toEqual([
      sample[0],
    ])
  })

  it('sorts by title', () => {
    expect(
      filterAndSortLibraryBooks(sample, '', 'title').map((b) => b.id),
    ).toEqual(['b', 'c', 'a'])
  })

  it('reverses list order for created', () => {
    expect(
      filterAndSortLibraryBooks(sample, '', 'created').map((b) => b.id),
    ).toEqual(['c', 'b', 'a'])
  })

  it('keeps list order for last edited', () => {
    expect(
      filterAndSortLibraryBooks(sample, '', 'edited').map((b) => b.id),
    ).toEqual(['a', 'b', 'c'])
  })
})
