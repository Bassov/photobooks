import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import {
  isJpegLikeFile,
  isJpegSoi,
  parseJpegHead,
  positiveInt,
} from './jpegHead'

const exifrApi = vi.hoisted(() => ({
  thumbnail: vi.fn(),
  orientation: vi.fn(),
  parse: vi.fn(),
}))

const normalizeOrientationMock = vi.hoisted(() => vi.fn())

vi.mock('./normalizeOrientation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./normalizeOrientation')>()
  return {
    normalizeOrientation: (
      ...args: Parameters<typeof actual.normalizeOrientation>
    ): ReturnType<typeof actual.normalizeOrientation> => {
      const impl = normalizeOrientationMock.getMockImplementation()
      if (impl) {
        return normalizeOrientationMock(...args) as ReturnType<
          typeof actual.normalizeOrientation
        >
      }
      return actual.normalizeOrientation(...args)
    },
  }
})

vi.mock('exifr', () => ({
  default: {
    thumbnail: (...args: unknown[]): unknown =>
      exifrApi.thumbnail(...args) as unknown,
    orientation: (...args: unknown[]): unknown =>
      exifrApi.orientation(...args) as unknown,
    parse: (...args: unknown[]): unknown => exifrApi.parse(...args) as unknown,
  },
}))

function asBuffer(nodeBuf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(nodeBuf.byteLength)
  copy.set(nodeBuf)
  return copy.buffer
}

describe('isJpegSoi', () => {
  it.each([
    [new Uint8Array([0xff, 0xd8]), true],
    [new Uint8Array([0xff]), false],
    [new Uint8Array([0xff, 0x00]), false],
    [new Uint8Array([0x00, 0xd8]), false],
  ])('detects SOI for %j', (bytes, expected) => {
    expect(isJpegSoi(bytes)).toBe(expected)
  })
})

describe('positiveInt', () => {
  it.each([
    [1, 1],
    [8.5, 8.5],
    [0, null],
    [-1, null],
    [Number.NaN, null],
    ['4', null],
  ])('normalizes %s to %s', (value, expected) => {
    expect(positiveInt(value)).toBe(expected)
  })
})

describe('parseJpegHead', () => {
  beforeEach(() => {
    exifrApi.thumbnail.mockReset()
    exifrApi.orientation.mockReset()
    exifrApi.parse.mockReset()
    normalizeOrientationMock.mockReset()
    exifrApi.thumbnail.mockResolvedValue(undefined)
    exifrApi.orientation.mockResolvedValue(1)
    exifrApi.parse.mockResolvedValue({})
  })

  it('reads SOF size and orientation from the orientation fixture', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.orientation.mockResolvedValue(6)

    const result = await parseJpegHead(asBuffer(original))

    expect(result.width).toBe(40)
    expect(result.height).toBe(20)
    expect(result.orientation).toBe(6)
    expect(result.correctedWidth).toBe(20)
    expect(result.correctedHeight).toBe(40)
  })

  it('returns embedded JPEG thumb when exifr.thumbnail yields SOI bytes', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x01, 0x02])
    exifrApi.thumbnail.mockResolvedValue(thumb)

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toEqual(thumb)
    expect(result.thumbJpeg).not.toBe(thumb)
  })

  it('treats absent EXIF thumb as null', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.thumbnail.mockResolvedValue(undefined)

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toBeNull()
  })

  it('treats one-byte EXIF thumb payload as null', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.thumbnail.mockResolvedValue(new Uint8Array([0xff]))

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toBeNull()
  })

  it('ignores non-Uint8Array thumbnail payloads from exifr', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.thumbnail.mockResolvedValue(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer,
    )

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toBeNull()
  })

  it('treats corrupt EXIF thumb (no SOI) as null', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.thumbnail.mockResolvedValue(new Uint8Array([0x00, 0x01, 0x02]))

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toBeNull()
  })

  it('treats thumbnail throw as null thumb without crashing', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    exifrApi.thumbnail.mockRejectedValue(new Error('bad ifd1'))

    const result = await parseJpegHead(asBuffer(original))

    expect(result.thumbJpeg).toBeNull()
    expect(result.width).toBe(40)
  })

  it('returns empty result for truncated JPEG SOI', async () => {
    const result = await parseJpegHead(new Uint8Array([0xff]).buffer)

    expect(result).toEqual({
      thumbJpeg: null,
      width: null,
      height: null,
      orientation: 1,
      correctedWidth: null,
      correctedHeight: null,
    })
    expect(exifrApi.thumbnail).not.toHaveBeenCalled()
  })

  it('returns empty result for wrong JPEG magic bytes', async () => {
    const result = await parseJpegHead(
      new Uint8Array([0xff, 0xd9, 0xff, 0xd8]).buffer,
    )

    expect(result.thumbJpeg).toBeNull()
    expect(result.width).toBeNull()
    expect(exifrApi.thumbnail).not.toHaveBeenCalled()
  })

  it('returns empty result for non-JPEG buffers', async () => {
    const result = await parseJpegHead(new Uint8Array([0x00, 0x01]).buffer)

    expect(result).toEqual({
      thumbJpeg: null,
      width: null,
      height: null,
      orientation: 1,
      correctedWidth: null,
      correctedHeight: null,
    })
    expect(exifrApi.thumbnail).not.toHaveBeenCalled()
  })

  it('uses ExifImageWidth/Height when SOF and ImageWidth are absent', async () => {
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    exifrApi.parse.mockImplementation((_buffer, options) => {
      const pick = (options as { pick?: string[] } | undefined)?.pick ?? []
      if (pick.includes('ExifImageWidth')) {
        return { ExifImageWidth: 640, ExifImageHeight: 480 }
      }
      return {}
    })

    const result = await parseJpegHead(head)

    expect(result.width).toBe(640)
    expect(result.height).toBe(480)
    expect(result.correctedWidth).toBe(640)
    expect(result.correctedHeight).toBe(480)
  })

  it('ignores non-positive EXIF size fields', async () => {
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    exifrApi.parse.mockResolvedValue({
      ImageWidth: 0,
      ImageHeight: -3,
      ExifImageWidth: Number.NaN,
    })

    const result = await parseJpegHead(head)

    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
    expect(result.correctedWidth).toBeNull()
  })

  it('falls back to raw width and height when orientation normalize throws', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    normalizeOrientationMock.mockImplementation(() => {
      throw new RangeError('bad orientation transform')
    })

    const result = await parseJpegHead(asBuffer(original))

    expect(result.width).toBe(40)
    expect(result.height).toBe(20)
    expect(result.correctedWidth).toBe(40)
    expect(result.correctedHeight).toBe(20)
  })

  it('uses image/jpg MIME alias in isJpegLikeFile', () => {
    expect(isJpegLikeFile({ name: 'x.bin', type: 'image/jpg' })).toBe(true)
  })

  it('ignores non-object EXIF size payloads', async () => {
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    exifrApi.parse.mockResolvedValue('not-an-object')

    const result = await parseJpegHead(head)

    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
  })

  it('uses EXIF size fields when SOF is absent', async () => {
    // SOI only — no SOF markers.
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    exifrApi.parse.mockResolvedValue({
      ImageWidth: 800,
      ImageHeight: 600,
    })
    exifrApi.orientation.mockResolvedValue(1)

    const result = await parseJpegHead(head)

    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
    expect(result.correctedWidth).toBe(800)
    expect(result.correctedHeight).toBe(600)
  })

  it('leaves corrected dims null when only one EXIF size is present', async () => {
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    exifrApi.parse.mockResolvedValue({ ImageWidth: 800 })

    const result = await parseJpegHead(head)

    expect(result.width).toBe(800)
    expect(result.height).toBeNull()
    expect(result.correctedWidth).toBeNull()
    expect(result.correctedHeight).toBeNull()
  })
})

describe('isJpegLikeFile', () => {
  it.each([
    [{ name: 'a.jpg', type: '' }, true],
    [{ name: 'a.JPEG', type: 'application/octet-stream' }, true],
    [{ name: 'a.png', type: 'image/jpeg' }, true],
    [{ name: 'a.png', type: 'image/prs.jxl+jpeg' }, true],
    [{ name: 'a.png', type: 'image/png' }, false],
    [{ name: 'a.heic', type: 'image/heic' }, false],
  ])('classifies %j as %s', (file, expected) => {
    expect(isJpegLikeFile(file)).toBe(expected)
  })
})
