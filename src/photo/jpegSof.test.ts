import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { readJpegSofSize, stripJpegExif } from './jpegSof'
import exifr from 'exifr'

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

describe('jpegSof', () => {
  it('reads SOF size and strips EXIF from orientation fixture', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    const size = readJpegSofSize(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(size).toEqual({ width: 40, height: 20 })
    expect(await exifr.orientation(original)).toBe(6)

    const stripped = stripJpegExif(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(await exifr.orientation(stripped)).toBeUndefined()
    expect(readJpegSofSize(stripped)).toEqual({ width: 40, height: 20 })
  })

  it('returns null for non-JPEG or truncated buffers', () => {
    expect(readJpegSofSize(bytes(0xff))).toBeNull()
    expect(readJpegSofSize(bytes(0x00, 0xd8, 0xff, 0xc0))).toBeNull()
    expect(readJpegSofSize(bytes(0xff, 0xd8, 0xff, 0xc0))).toBeNull()
  })

  it('skips filler bytes and stops on SOS / EOI before SOF', () => {
    expect(
      readJpegSofSize(
        bytes(0xff, 0xd8, 0x00, 0xff, 0xda, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
      ),
    ).toBeNull()
    expect(
      readJpegSofSize(
        bytes(0xff, 0xd8, 0xff, 0xd9, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
      ),
    ).toBeNull()
  })

  it('reads SOF after a skipped APP0-like segment', () => {
    const buffer = bytes(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00,
      0xff,
      0xc0,
      0x00,
      0x0b,
      0x08,
      0x00,
      0x10,
      0x00,
      0x20,
      0x03,
      0x01,
      0x22,
      0x00,
    )
    expect(readJpegSofSize(buffer)).toEqual({ width: 32, height: 16 })
  })

  it('returns null when SOF dimensions are zero or segment length is invalid', () => {
    expect(
      readJpegSofSize(
        bytes(
          0xff,
          0xd8,
          0xff,
          0xc0,
          0x00,
          0x0b,
          0x08,
          0x00,
          0x00,
          0x00,
          0x20,
          0x03,
          0x01,
          0x22,
          0x00,
        ),
      ),
    ).toBeNull()
    expect(
      readJpegSofSize(
        bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00),
      ),
    ).toBeNull()
  })

  it('returns original buffer from stripJpegExif for non-JPEG input', () => {
    const buffer = bytes(0x00, 0x01, 0x02, 0x03)
    expect(stripJpegExif(buffer)).toBe(buffer)
  })

  it('keeps non-Exif APP1 and stops at SOS when stripping', () => {
    const buffer = bytes(
      0xff,
      0xd8,
      0xff,
      0xe1,
      0x00,
      0x06,
      0x41,
      0x41,
      0x41,
      0x41,
      0xff,
      0xda,
      0x00,
      0x02,
    )
    const stripped = new Uint8Array(stripJpegExif(buffer))
    expect([...stripped]).toEqual([...new Uint8Array(buffer)])
  })

  it('truncates strip when a segment length overruns the buffer', () => {
    const buffer = bytes(0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x00)
    const stripped = new Uint8Array(stripJpegExif(buffer))
    expect(stripped.byteLength).toBeGreaterThanOrEqual(2)
    expect(stripped[0]).toBe(0xff)
    expect(stripped[1]).toBe(0xd8)
  })
})
