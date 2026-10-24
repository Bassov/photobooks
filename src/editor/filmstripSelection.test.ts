import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSelectedAssetId, resetGallerySelection } from './gallerySelection'
import {
  applyFilmstripSelectionChange,
  onFilmstripGridSelectionChange,
} from './filmstripSelection'

describe('applyFilmstripSelectionChange', () => {
  afterEach(() => {
    resetGallerySelection()
  })

  it('ignores the all-keys sentinel', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange('all', setSelected)
    expect(setSelected).not.toHaveBeenCalled()
  })

  it('selects a string asset id from a key set', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(
      { values: () => ['asset-1'][Symbol.iterator]() },
      setSelected,
    )
    expect(setSelected).toHaveBeenCalledWith('asset-1')
  })

  it('clears selection when the key is not a string', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(
      { values: () => [42][Symbol.iterator]() },
      setSelected,
    )
    expect(setSelected).toHaveBeenCalledWith(null)
  })

  it('clears selection when the key set is empty', () => {
    const setSelected = vi.fn()
    applyFilmstripSelectionChange(
      { values: () => [][Symbol.iterator]() },
      setSelected,
    )
    expect(setSelected).toHaveBeenCalledWith(null)
  })

  it('onFilmstripGridSelectionChange writes the gallery selection store', () => {
    onFilmstripGridSelectionChange({
      values: () => ['grid-asset'][Symbol.iterator](),
    })
    expect(getSelectedAssetId()).toBe('grid-asset')
    onFilmstripGridSelectionChange('all')
    expect(getSelectedAssetId()).toBe('grid-asset')
    onFilmstripGridSelectionChange({
      values: () => [][Symbol.iterator](),
    })
    expect(getSelectedAssetId()).toBeNull()
  })
})
