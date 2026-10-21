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

function sampleLossyWebpFile(): File {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const bytes = readFileSync(photoFixturePaths.sampleLossyWebp)
  return new File([bytes], 'sample-lossy.webp', { type: 'image/webp' })
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

  it('maps decode failure + HEIC signature to HEIC message', async () => {
    const size = 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0
    bytes[1] = 0
    bytes[2] = 0
    bytes[3] = size
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x68, 0x65, 0x69, 0x63], 8) // heic
    const file = new File([bytes], 'phone.jpg', { type: 'image/jpeg' })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('decode failed')),
    )

    const result = await processPhotoRequest({ id: 'req-heic-sig', file })

    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    expect(result.error).toMatch(/HEIC isn't supported yet/)
    expect(result.error).toMatch(/Most Compatible/)
  })

  it('succeeds for WebP when EXIF size parse throws Unknown file format', async () => {
    const file = sampleLossyWebpFile()
    exifrApi.parse.mockRejectedValue(new Error('Unknown file format'))
    stubImageDecodeApis({ width: 30, height: 20 })

    const result = await processPhotoRequest({ id: 'req-webp', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.width).toBe(30)
    expect(result.height).toBe(20)
    expect(result.mimeType).toBe('image/webp')
  })

  it('still fails WebP when createImageBitmap rejects after size-parse throw', async () => {
    const file = sampleLossyWebpFile()
    exifrApi.parse.mockRejectedValue(new Error('Unknown file format'))
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('decode failed')),
    )

    const result = await processPhotoRequest({ id: 'req-webp-decode', file })

    expect(result).toEqual({
      id: 'req-webp-decode',
      ok: false,
      error: 'decode failed',
    })
  })

  it('prefers EXIF ImageWidth/Height over bitmap when parse succeeds', async () => {
    const file = samplePngFile()
    exifrApi.parse.mockResolvedValue({ ImageWidth: 100, ImageHeight: 50 })
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-exif-size', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  it('prefers ExifImageWidth/Height when ImageWidth fields are absent', async () => {
    const file = samplePngFile()
    exifrApi.parse.mockResolvedValue({
      ExifImageWidth: 90,
      ExifImageHeight: 60,
    })
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-exif-alt', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.width).toBe(90)
    expect(result.height).toBe(60)
  })

  it('defaults mimeType to application/octet-stream when File.type is empty', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.samplePng)
    const file = new File([bytes], 'no-type.bin', { type: '' })
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-mime', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.mimeType).toBe('application/octet-stream')
  })

  it('passes imageOrientation none to createImageBitmap', async () => {
    const file = samplePngFile()
    const { createImageBitmap } = stubImageDecodeApis({
      width: 12,
      height: 8,
    })

    await processPhotoRequest({ id: 'req-orient-none', file })

    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'none',
    })
  })

  it('applies orientation transform with rotate and flip scales', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue(2)
    const { ctx } = stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-flip', file })

    expect(result.ok).toBe(true)
    expect(ctx.rotate).toHaveBeenCalled()
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(ctx.translate).toHaveBeenCalledWith(20, 10)
    expect(ctx.translate).toHaveBeenCalledWith(-20, -10)
  })

  it('strips JPEG EXIF before createImageBitmap for image/jpeg', async () => {
    const file = sampleOrient6File()
    const sourceSize = file.size
    exifrApi.orientation.mockResolvedValue(1)
    const { createImageBitmap } = stubImageDecodeApis({
      width: 40,
      height: 20,
    })

    await processPhotoRequest({ id: 'req-strip', file })

    const blob = createImageBitmap.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBeLessThan(sourceSize)
  })

  it('does not treat image/webp as JPEG for EXIF strip', async () => {
    const file = sampleLossyWebpFile()
    const sourceSize = file.size
    exifrApi.parse.mockRejectedValue(new Error('Unknown file format'))
    const { createImageBitmap } = stubImageDecodeApis({
      width: 30,
      height: 20,
    })

    await processPhotoRequest({ id: 'req-webp-nostrip', file })

    const blob = createImageBitmap.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('image/webp')
    expect(blob.size).toBe(sourceSize)
  })

  it.each([1, 8] as const)(
    'accepts orientation %s from exifr.orientation',
    async (orientation) => {
      const file = samplePngFile()
      exifrApi.orientation.mockResolvedValue(orientation)
      stubImageDecodeApis({ width: 40, height: 20 })

      const result = await processPhotoRequest({
        id: `req-o${String(orientation)}`,
        file,
      })

      expect(result.ok).toBe(true)
      assert.equal(result.ok, true)
      expect(result.orientation).toBe(orientation)
    },
  )

  it.each([0, 9])('rejects out-of-range orientation number %s', async (raw) => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue(raw)
    exifrApi.parse.mockResolvedValue({})
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({
      id: `req-bad-${String(raw)}`,
      file,
    })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(1)
  })

  it('rejects out-of-range Orientation from exifr.parse object', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue(undefined)
    exifrApi.parse.mockResolvedValue({ Orientation: 0 })
    stubImageDecodeApis({ width: 12, height: 8 })

    const result = await processPhotoRequest({ id: 'req-parse-0', file })

    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.orientation).toBe(1)
  })

  it('applies flipY scale for orientation 4 and exact rotate for 6', async () => {
    const file = samplePngFile()
    exifrApi.orientation.mockResolvedValue(4)
    const flip = stubImageDecodeApis({ width: 40, height: 20 })
    await processPhotoRequest({ id: 'req-flip-y', file })
    expect(flip.ctx.scale).toHaveBeenCalledWith(1, -1)

    exifrApi.orientation.mockResolvedValue(6)
    const rot = stubImageDecodeApis({ width: 40, height: 20 })
    await processPhotoRequest({ id: 'req-rot-6', file })
    expect(rot.ctx.rotate).toHaveBeenCalledWith((90 * Math.PI) / 180)
    expect(rot.ctx.rotate).not.toHaveBeenCalledWith(90 * Math.PI * 180)
    expect(rot.ctx.rotate).not.toHaveBeenCalledWith(90 / Math.PI)
  })

  it('cover scale uses division by long edge, draws, and encodes webp for PNG', async () => {
    const file = samplePngFile()
    const { ctx, getContext, convertToBlob } = stubImageDecodeApis({
      width: 40,
      height: 20,
    })

    const result = await processPhotoRequest({
      id: 'req-cover-math',
      file,
      maxEdge: 80,
      cover: true,
    })

    expect(getContext).toHaveBeenCalledWith('2d')
    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(ctx.drawImage).toHaveBeenCalled()
    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/webp',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/webp')
  })

  it('encodes JPEG sources as image/jpeg and reports blob type', async () => {
    const file = sampleOrient6File()
    const { convertToBlob } = stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-jpeg-enc', file })

    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/jpeg')
  })

  it('encodes image/jpg alias as image/jpeg preview', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample.jpg', { type: 'image/jpg' })
    const { convertToBlob } = stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-jpg-enc', file })

    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/jpeg')
  })

  it('encodes empty File.type as image/jpeg preview (not webp)', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample.bin', { type: '' })
    const { convertToBlob } = stubImageDecodeApis({ width: 40, height: 20 })

    const result = await processPhotoRequest({ id: 'req-empty-mime-enc', file })

    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/jpeg')
  })

  it('encodes WebP sources as image/webp and reports blob type', async () => {
    const file = sampleLossyWebpFile()
    exifrApi.parse.mockRejectedValue(new Error('Unknown file format'))
    const { convertToBlob } = stubImageDecodeApis({ width: 30, height: 20 })

    const result = await processPhotoRequest({ id: 'req-webp-enc', file })

    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/webp',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/webp')
  })

  it('labels previewMimeType from blob.type when browser falls back', async () => {
    const file = samplePngFile()
    const { convertToBlob } = stubImageDecodeApis({ width: 12, height: 8 })
    convertToBlob.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    )

    const result = await processPhotoRequest({ id: 'req-fallback', file })

    expect(convertToBlob).toHaveBeenCalledWith({
      type: 'image/webp',
      quality: 0.85,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.previewMimeType).toBe('image/png')
  })

  it('treats image/jpg as JPEG for EXIF strip like image/jpeg', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample.jpg', { type: 'image/jpg' })
    exifrApi.orientation.mockResolvedValue(1)
    const { createImageBitmap } = stubImageDecodeApis({
      width: 40,
      height: 20,
    })

    await processPhotoRequest({ id: 'req-jpg-alias', file })

    const blob = createImageBitmap.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('image/jpg')
    expect(blob.size).toBeGreaterThan(0)
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
