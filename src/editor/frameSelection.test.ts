import { afterEach, describe, expect, it } from 'vitest'
import {
  frameControlLabel,
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
  withSelectionSync,
} from './frameSelection'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'

describe('frameSelection', () => {
  afterEach(() => {
    resetFrameSelection()
    resetGallerySelection()
  })

  it('clears the gallery asset when a frame source is set, and the reverse', () => {
    setSelectedAssetId('a')
    setFrameSource({ spreadId: 's', frameId: 'f' })

    expect(getSelectedAssetId()).toBeNull()
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'f' })

    setSelectedAssetId('b')

    expect(getFrameSource()).toBeNull()
    expect(getSelectedAssetId()).toBe('b')
  })

  it('keeps the same source object when the ids do not change', () => {
    setFrameSource({ spreadId: 's', frameId: 'f' })
    const first = getFrameSource()
    setFrameSource({ spreadId: 's', frameId: 'f' })
    expect(getFrameSource()).toBe(first)
  })

  it('treats the same frame id on another spread as a different source', () => {
    setFrameSource({ spreadId: 's0', frameId: 'f' })
    setFrameSource({ spreadId: 's1', frameId: 'f' })

    expect(getFrameSource()).toEqual({ spreadId: 's1', frameId: 'f' })
    expect(
      frameControlLabel(
        true,
        false,
        { spreadId: 's0', frameId: 'f' },
        { spreadId: 's1', frameId: 'f' },
      ),
    ).toBe('Swap photos')
  })

  it('ignores a nested selection sync', () => {
    let calls = 0
    withSelectionSync(() => {
      calls += 1
      withSelectionSync(() => {
        calls += 1
      })
    })
    expect(calls).toBe(1)
  })

  it('names place, replace, select, swap, and move', () => {
    const frame = { spreadId: 's', frameId: 'f' }
    const other = { spreadId: 's', frameId: 'g' }
    expect(frameControlLabel(false, true, null, frame)).toBe('Place photo')
    expect(frameControlLabel(true, true, null, frame)).toBe('Replace photo')
    expect(frameControlLabel(false, false, null, frame)).toBe('Place photo')
    expect(frameControlLabel(true, false, null, frame)).toBe(
      'Select photo to move',
    )
    expect(frameControlLabel(true, false, frame, frame)).toBe(
      'Select photo to move',
    )
    expect(frameControlLabel(true, false, frame, other)).toBe('Swap photos')
    expect(frameControlLabel(false, false, frame, other)).toBe(
      'Move photo here',
    )
  })
})
