import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import {
  getGalleryPhotoSelected,
  getSelectedAssetId,
  getSelectedAssetIds,
  resetGallerySelection,
  setSelectedAssetId,
  setSelectedAssetIds,
  subscribeGalleryPhotoSelected,
  subscribeGallerySelection,
} from './gallerySelection'

describe('gallerySelection', () => {
  afterEach(() => {
    resetGallerySelection()
    resetFrameSelection()
  })

  it('starts empty', () => {
    expect(getSelectedAssetIds()).toEqual([])
    expect(getSelectedAssetId()).toBeNull()
    expect(getGalleryPhotoSelected()).toBe(false)
  })

  it('defaults the primary to the last id and honours an explicit one', () => {
    setSelectedAssetIds(['a', 'b'])
    expect(getSelectedAssetIds()).toEqual(['a', 'b'])
    expect(getSelectedAssetId()).toBe('b')
    setSelectedAssetIds(['a', 'b'], 'a')
    expect(getSelectedAssetId()).toBe('a')
  })

  it('de-duplicates ids and has no primary when empty', () => {
    setSelectedAssetIds(['a', 'a', 'b'])
    expect(getSelectedAssetIds()).toEqual(['a', 'b'])
    setSelectedAssetIds([], 'a')
    expect(getSelectedAssetIds()).toEqual([])
    expect(getSelectedAssetId()).toBeNull()
  })

  it('single-id setter selects one photo or clears', () => {
    setSelectedAssetId('x')
    expect(getSelectedAssetIds()).toEqual(['x'])
    expect(getSelectedAssetId()).toBe('x')
    setSelectedAssetId(null)
    expect(getSelectedAssetIds()).toEqual([])
    expect(getGalleryPhotoSelected()).toBe(false)
  })

  it('only notifies when the selection really changes', () => {
    const listener = vi.fn()
    const off = subscribeGallerySelection(listener)
    setSelectedAssetIds(['a', 'b'])
    expect(listener).toHaveBeenCalledTimes(1)
    setSelectedAssetIds(['a', 'b'])
    expect(listener).toHaveBeenCalledTimes(1)
    setSelectedAssetIds(['b', 'a'], 'b')
    expect(listener).toHaveBeenCalledTimes(2)
    setSelectedAssetIds(['a', 'b'], 'b')
    expect(listener).toHaveBeenCalledTimes(3)
    setSelectedAssetIds(['a', 'b'], 'a')
    expect(listener).toHaveBeenCalledTimes(4)
    setSelectedAssetIds(['a'], 'a')
    expect(listener).toHaveBeenCalledTimes(5)
    setSelectedAssetIds(['a', 'c'], 'a')
    expect(listener).toHaveBeenCalledTimes(6)
    off()
    setSelectedAssetIds([])
    expect(listener).toHaveBeenCalledTimes(6)
  })

  it('keeps a stable snapshot between unchanged writes', () => {
    setSelectedAssetIds(['a', 'b'])
    const first = getSelectedAssetIds()
    setSelectedAssetIds(['a', 'b'])
    expect(getSelectedAssetIds()).toBe(first)
  })

  it('photo-selected subscription fires only on the has/none edge', () => {
    const listener = vi.fn()
    const off = subscribeGalleryPhotoSelected(listener)
    setSelectedAssetIds(['a'])
    setSelectedAssetIds(['a', 'b'])
    expect(listener).toHaveBeenCalledTimes(1)
    setSelectedAssetIds([])
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })

  it('selecting photos drops the frame selection; clearing does not', () => {
    setFrameSource({ spreadId: 's', frameId: 'f' })
    setSelectedAssetIds([])
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'f' })
    setSelectedAssetIds(['a'])
    expect(getFrameSource()).toBeNull()
  })
})
