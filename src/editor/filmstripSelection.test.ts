import { describe, expect, it } from 'vitest'
import { filmstripSelectionAssetId } from './filmstripSelection'

describe('filmstripSelectionAssetId', () => {
  it('returns undefined for the all-keys sentinel so selection is unchanged', () => {
    expect(filmstripSelectionAssetId('all')).toBeUndefined()
  })

  it('returns the string asset id from a key set', () => {
    const keys = {
      values: () => ['asset-1'][Symbol.iterator](),
    }
    expect(filmstripSelectionAssetId(keys)).toBe('asset-1')
  })

  it('returns null when the key is not a string', () => {
    const keys = {
      values: () => [42][Symbol.iterator](),
    }
    expect(filmstripSelectionAssetId(keys)).toBeNull()
  })

  it('returns null when the key set is empty', () => {
    const keys = {
      values: () => [][Symbol.iterator](),
    }
    expect(filmstripSelectionAssetId(keys)).toBeNull()
  })
})
