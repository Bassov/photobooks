import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  resetBookStore,
  setAssetSessionMeta,
} from './bookStore'
import {
  restoreAspectFromImage,
  restoreAspectFromPreview,
} from './previewAspect'

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

describe('restoreAspectFromImage', () => {
  const meta = () => getBookStoreSnapshot().sessionMeta.get('a1')

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

  it('replaces a placeholder aspect and keeps the dims unknown', () => {
    setAssetSessionMeta('a1', {
      name: 'p.jpg',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 6,
      aspect: 1,
    })

    restoreAspectFromImage('a1', 960, 1280)

    expect(meta()).toEqual({
      name: 'p.jpg',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 6,
      aspect: 0.75,
    })
  })

  it('seeds an aspect for an asset with no session meta', () => {
    restoreAspectFromImage('a1', 1280, 853)

    expect(meta()).toEqual({
      name: 'a1',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      aspect: 1280 / 853,
    })
  })

  it('keeps real decoded dims', () => {
    restoreAspectFromPreview('a1', jpegLandscape200x100(), 'image/jpeg')

    restoreAspectFromImage('a1', 853, 1280)

    expect(getAssetAspectSnapshot('a1')).toBe(2)
  })

  it('keeps an aspect within tier rounding and replaces one past it', () => {
    restoreAspectFromImage('a1', 1280, 853)
    const first = meta()

    restoreAspectFromImage('a1', 320, 213)
    expect(meta()).toBe(first)

    restoreAspectFromImage('a1', 1280, 840)
    expect(getAssetAspectSnapshot('a1')).toBe(1280 / 840)
  })

  it('ignores an image with no decoded size', () => {
    restoreAspectFromImage('a1', 0, 1280)
    restoreAspectFromImage('a1', 1280, 0)

    expect(meta()).toBeUndefined()
  })
})
