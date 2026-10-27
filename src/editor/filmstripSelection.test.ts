import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSelectedAssetId,
  getSelectedAssetIds,
  resetGallerySelection,
  setSelectedAssetIds,
} from './gallerySelection'
import {
  applyFilmstripSelectionChange,
  filmstripSelectionHandler,
  matchingSelection,
} from './filmstripSelection'

const keysOf = (...values: unknown[]) => ({
  values: () => values[Symbol.iterator](),
})

describe('applyFilmstripSelectionChange', () => {
  afterEach(() => {
    resetGallerySelection()
  })

  it('selects every view id for the all-keys sentinel', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange('all', setSelected, ['a', 'b', 'c'], [])
    expect(setSelected).toHaveBeenCalledWith(['a', 'b', 'c'], 'c')
    applyFilmstripSelectionChange('all', setSelected, [], [])
    expect(setSelected).toHaveBeenLastCalledWith([], null)
  })

  it('selects a string asset id from a key set', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(keysOf('asset-1'), setSelected, [], [])
    expect(setSelected).toHaveBeenCalledWith(['asset-1'], 'asset-1')
  })

  it('picks the newly added key as primary', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(
      keysOf('a', 'b', 'c'),
      setSelected,
      [],
      ['a', 'c'],
    )
    expect(setSelected).toHaveBeenCalledWith(['a', 'b', 'c'], 'b')
  })

  it('falls back to the last key when nothing was added', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(
      keysOf('a', 'b'),
      setSelected,
      [],
      ['a', 'b', 'c'],
    )
    expect(setSelected).toHaveBeenCalledWith(['a', 'b'], 'b')
  })

  it('drops non-string keys and clears on an empty set', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(keysOf(42), setSelected, [], [])
    expect(setSelected).toHaveBeenCalledWith([], null)
  })
})

describe('filmstripSelectionHandler', () => {
  afterEach(() => {
    resetGallerySelection()
  })

  it('writes the store, remembers the raw selection and diffs against it', () => {
    const remember = vi.fn()
    const handler = filmstripSelectionHandler(['x', 'y', 'z'], remember)
    setSelectedAssetIds(['x'])
    const range = new Set(['x', 'y', 'z'])
    handler(range)
    expect(remember).toHaveBeenCalledWith(range)
    expect(getSelectedAssetIds()).toEqual(['x', 'y', 'z'])
    expect(getSelectedAssetId()).toBe('z')
    handler('all')
    expect(getSelectedAssetIds()).toEqual(['x', 'y', 'z'])
    handler(new Set())
    expect(getSelectedAssetId()).toBeNull()
    expect(getSelectedAssetIds()).toEqual([])
  })
})

describe('matchingSelection', () => {
  it('hands back the raw selection while it matches the store ids', () => {
    const raw = new Set(['a', 'b'])
    expect(matchingSelection(raw, ['b', 'a'])).toBe(raw)
  })

  it('falls back to the ids for no, all, or a different selection', () => {
    const ids = ['a', 'b']
    expect(matchingSelection(null, ids)).toBe(ids)
    expect(matchingSelection('all', ids)).toBe(ids)
    expect(matchingSelection(new Set(['a']), ids)).toBe(ids)
    expect(matchingSelection(new Set(['a', 'c']), ids)).toBe(ids)
    expect(matchingSelection(new Set(['a', 'b', 'c']), ids)).toBe(ids)
  })
})
