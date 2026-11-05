import { describe, expect, it } from 'vitest'
import { encodedImageSize } from './encodedImageSize'

/** RIFF/WEBP file with `chunk` first; padded to `minLength` bytes. */
function riff(chunk: string, payload: number[], minLength = 30): Uint8Array {
  const head = new TextEncoder().encode('RIFF')
  const webp = new TextEncoder().encode(`WEBP${chunk}`)
  const bytes = [...head, 0, 0, 0, 0, ...webp, 0, 0, 0, 0, ...payload]
  while (bytes.length < minLength) {
    bytes.push(0)
  }
  return new Uint8Array(bytes)
}

const le16 = (value: number) => [value & 0xff, value >> 8]
const le24 = (value: number) => [value & 0xff, (value >> 8) & 0xff, value >> 16]
const be16 = (value: number) => [value >> 8, value & 0xff]

/** SOI, then `segments`, each `[marker, ...payload]` with its length field. */
function jpeg(...segments: number[][]): Uint8Array {
  const out = [0xff, 0xd8]
  for (const [marker = 0, ...payload] of segments) {
    out.push(0xff, marker, ...be16(payload.length + 2), ...payload)
  }
  return new Uint8Array(out)
}

const sof = (marker: number, width: number, height: number) => [
  marker,
  8,
  ...be16(height),
  ...be16(width),
  3,
]

describe('encodedImageSize: WebP', () => {
  it('reads a lossy VP8 key frame', () => {
    const bytes = riff('VP8 ', [
      0x10,
      0x02,
      0x00,
      0x9d,
      0x01,
      0x2a,
      ...le16(1600 | 0x4000), // scale bits are masked off
      ...le16(1067),
    ])
    expect(encodedImageSize(bytes)).toEqual({ width: 1600, height: 1067 })
  })

  it('reads a lossless VP8L header', () => {
    const bits = (480 - 1) | ((320 - 1) << 14)
    const bytes = riff('VP8L', [
      0x2f,
      bits & 0xff,
      (bits >> 8) & 0xff,
      (bits >> 16) & 0xff,
      (bits >>> 24) & 0xff,
    ])
    expect(encodedImageSize(bytes)).toEqual({ width: 480, height: 320 })
  })

  it('reads an extended VP8X canvas, 24-bit sizes included', () => {
    const bytes = riff('VP8X', [
      0x10,
      0,
      0,
      0,
      ...le24(70_000 - 1),
      ...le24(2133 - 1),
    ])
    expect(encodedImageSize(bytes)).toEqual({ width: 70_000, height: 2133 })
  })

  it('refuses short files, unknown chunks and a bad VP8L signature', () => {
    const vp8 = riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 10, 0, 10, 0])
    expect(encodedImageSize(vp8.subarray(0, 29))).toBeUndefined()
    expect(encodedImageSize(riff('ALPH', [0x2f, 1, 2, 3, 4]))).toBeUndefined()
    expect(encodedImageSize(riff('VP8L', [0x00, 1, 2, 3, 4]))).toBeUndefined()
  })

  it('needs both RIFF and WEBP', () => {
    const bytes = riff('VP8X', [0, 0, 0, 0, ...le24(9), ...le24(9)])
    const notRiff = bytes.slice()
    notRiff[0] = 0x58
    const notWebp = bytes.slice()
    notWebp[8] = 0x58
    expect(encodedImageSize(notRiff)).toBeUndefined()
    expect(encodedImageSize(notWebp)).toBeUndefined()
  })
})

describe('encodedImageSize: JPEG', () => {
  it.each([0xc0, 0xc1, 0xc2, 0xcf])(
    'reads SOF marker %i after other segments',
    (marker) => {
      const bytes = jpeg([0xe0, 0, 0], [0xdb, 1], sof(marker, 1600, 900))
      expect(encodedImageSize(bytes)).toEqual({ width: 1600, height: 900 })
    },
  )

  it.each([0xc4, 0xc8, 0xcc, 0xbf, 0xd0])(
    'skips marker %i, which carries no frame size',
    (marker) => {
      const bytes = jpeg([marker, 0, 0, 0, 0, 0, 0, 0], sof(0xc0, 64, 48))
      expect(encodedImageSize(bytes)).toEqual({ width: 64, height: 48 })
    },
  )

  it('skips fill bytes before a marker', () => {
    const bytes = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      ...jpeg(sof(0xc0, 5, 7)).slice(2),
    ])
    expect(encodedImageSize(bytes)).toEqual({ width: 5, height: 7 })
  })

  it('returns undefined for broken or truncated data', () => {
    expect(encodedImageSize(new Uint8Array([1, 2, 3]))).toBeUndefined()
    const notSoi = jpeg(sof(0xc0, 5, 7))
    notSoi[1] = 0xd9
    expect(encodedImageSize(notSoi)).toBeUndefined()
    const notFf = jpeg(sof(0xc0, 5, 7))
    notFf[0] = 0x00
    expect(encodedImageSize(notFf)).toBeUndefined()
    const lostSync = jpeg([0xe0, 0, 0], sof(0xc0, 5, 7))
    lostSync[2] = 0x00
    expect(encodedImageSize(lostSync)).toBeUndefined()
    expect(
      encodedImageSize(jpeg(sof(0xc0, 5, 7)).subarray(0, 8)),
    ).toBeUndefined()
  })
})
