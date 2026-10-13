import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { stubImageDecodeApis } from './photo.test-helpers'
import { processPhotoRequest } from './processPhoto'

function samplePngFile(): File {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const bytes = readFileSync(photoFixturePaths.samplePng)
  return new File([bytes], 'sample.png', { type: 'image/png' })
}

describe('processPhotoRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns success with SOF size and orientation for JPEG fixture', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample-orient6.jpg', {
      type: 'image/jpeg',
    })
    stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-1', file })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.id).toBe('req-1')
    expect(result.name).toBe('sample-orient6.jpg')
    expect(result.width).toBe(40)
    expect(result.height).toBe(20)
    expect(result.correctedWidth).toBe(20)
    expect(result.correctedHeight).toBe(40)
    expect(result.orientation).toBe(6)
    expect(result.previewMimeType).toBe('image/jpeg')
    expect(result.previewBuffer.byteLength).toBeGreaterThan(0)
  })

  it('returns failure when createImageBitmap rejects', async () => {
    const file = samplePngFile()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('decode failed')),
    )

    const result = await processPhotoRequest({ id: 'req-2', file })

    expect(result).toEqual({
      id: 'req-2',
      ok: false,
      error: 'decode failed',
    })
  })

  it('returns generic failure message for non-Error throws', async () => {
    const file = samplePngFile()
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue('boom'))

    const result = await processPhotoRequest({ id: 'req-3', file })

    expect(result).toEqual({
      id: 'req-3',
      ok: false,
      error: 'Failed to load photo',
    })
  })

  it('falls back to bitmap size when SOF and EXIF sizes are absent', async () => {
    const file = samplePngFile()
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-4', file })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.width).toBe(12)
    expect(result.height).toBe(8)
    expect(result.correctedWidth).toBe(12)
    expect(result.correctedHeight).toBe(8)
    expect(result.orientation).toBe(1)
  })

  it('fails when OffscreenCanvas 2d context is unavailable', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample-orient6.jpg', {
      type: 'image/jpeg',
    })

    const bitmap = {
      width: 40,
      height: 20,
      close: vi.fn(),
    }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))

    class BrokenCanvas {
      getContext(): null {
        return null
      }
    }
    vi.stubGlobal('OffscreenCanvas', BrokenCanvas)

    const result = await processPhotoRequest({ id: 'req-5', file })

    expect(result).toEqual({
      id: 'req-5',
      ok: false,
      error: 'OffscreenCanvas 2d context unavailable',
    })
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
})
