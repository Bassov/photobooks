import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { stubImageDecodeApis } from './photo.test-helpers'

const exifrApi = vi.hoisted(() => ({
  orientation: vi.fn(),
  parse: vi.fn(),
}))

vi.mock('exifr', () => ({
  default: {
    orientation: (...args: unknown[]): unknown =>
      exifrApi.orientation(...args) as unknown,
    parse: (...args: unknown[]): unknown => exifrApi.parse(...args) as unknown,
  },
}))

import { processPhotoRequest } from './processPhoto'

function samplePngFile(): File {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const bytes = readFileSync(photoFixturePaths.samplePng)
  return new File([bytes], 'sample.png', { type: 'image/png' })
}

function sampleOrient6File(): File {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const bytes = readFileSync(photoFixturePaths.sampleOrient6)
  return new File([bytes], 'sample-orient6.jpg', { type: 'image/jpeg' })
}

describe('processPhotoRequest', () => {
  beforeEach(() => {
    exifrApi.orientation.mockReset()
    exifrApi.parse.mockReset()
    exifrApi.orientation.mockResolvedValue(1)
    exifrApi.parse.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns success with SOF size and orientation for JPEG fixture', async () => {
    const file = sampleOrient6File()
    exifrApi.orientation.mockResolvedValue(6)
    stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-1', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
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

  it('maps string EXIF orientation labels from exifr.orientation', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue('Rotate 90 CW')
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-label', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(6)
    expect(result.correctedWidth).toBe(8)
    expect(result.correctedHeight).toBe(12)
  })

  it('falls back to Orientation from exifr.parse when label is unknown', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue('not a real label')
    exifrApi.parse.mockImplementation(
      (_buffer: unknown, options?: { pick?: string[] }) => {
        const pick = options?.pick ?? []
        if (pick.includes('Orientation') && !pick.includes('ImageWidth')) {
          return Promise.resolve({ Orientation: 8 })
        }
        return Promise.resolve({})
      },
    )
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-parse', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(8)
    expect(result.correctedWidth).toBe(8)
    expect(result.correctedHeight).toBe(12)
  })

  it('defaults orientation to 1 when exifr.orientation throws', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockRejectedValue(new Error('exifr failed'))
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-catch', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(1)
  })

  it('ignores non-numeric Orientation from exifr.parse', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue('not a real label')
    exifrApi.parse.mockImplementation(
      (_buffer: unknown, options?: { pick?: string[] }) => {
        const pick = options?.pick ?? []
        if (pick.includes('Orientation') && !pick.includes('ImageWidth')) {
          return Promise.resolve({ Orientation: 'Rotate 90 CW' })
        }
        return Promise.resolve({})
      },
    )
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-bad-orient', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(1)
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
    assert.equal(result.ok, true)
    expect(result.width).toBe(12)
    expect(result.height).toBe(8)
    expect(result.correctedWidth).toBe(12)
    expect(result.correctedHeight).toBe(8)
    expect(result.orientation).toBe(1)
  })

  it('keeps the preview within the source size when cover is off', async () => {
    const file = samplePngFile()
    const sizes: number[] = []
    stubImageDecodeApis({
      width: 4,
      height: 2,
      onCanvas: (width, height) => {
        sizes.push(width, height)
      },
    })

    const result = await processPhotoRequest({
      id: 'req-cap',
      file,
      maxEdge: 8,
    })

    expect(result.ok).toBe(true)
    expect(sizes).toEqual([4, 2])
  })

  it('enlarges the preview to the requested edge when cover is on', async () => {
    const file = samplePngFile()
    const sizes: number[] = []
    stubImageDecodeApis({
      width: 4,
      height: 2,
      onCanvas: (width, height) => {
        sizes.push(width, height)
      },
    })

    const result = await processPhotoRequest({
      id: 'req-cover',
      file,
      maxEdge: 8,
      cover: true,
    })

    expect(result.ok).toBe(true)
    expect(sizes).toEqual([8, 4])
  })

  it('fails when OffscreenCanvas 2d context is unavailable', async () => {
    const file = sampleOrient6File()
    exifrApi.orientation.mockResolvedValue(6)

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
