import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { restoreAspectFromPreview } from './previewAspect'

/** Minimal JPEG with SOF0 width=200 height=100 (landscape). */
function jpegLandscape200x100(): ArrayBuffer {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ]).buffer
}

describe('restoreAspectFromPreview', () => {
  beforeEach(() => {
    resetBookStore()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    resetBookStore()
    vi.unstubAllGlobals()
  })

  it('sets landscape aspect from JPEG SOF without a worker', () => {
    restoreAspectFromPreview('a1', jpegLandscape200x100(), 'image/jpeg')
    expect(getAssetAspectSnapshot('a1')).toBe(2)
    const meta = getBookStoreSnapshot().sessionMeta.get('a1')
    expect(meta?.correctedWidth).toBe(200)
    expect(meta?.correctedHeight).toBe(100)
  })

  it('does not overwrite known corrected dimensions', () => {
    restoreAspectFromPreview('a1', jpegLandscape200x100(), 'image/jpeg')
    expect(getAssetAspectSnapshot('a1')).toBe(2)

    const square = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x32, 0x00, 0x32, 0x03,
      0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
    ]).buffer
    restoreAspectFromPreview('a1', square, 'image/jpeg')
    expect(getAssetAspectSnapshot('a1')).toBe(2)
  })
})
