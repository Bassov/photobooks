import { describe, expect, it } from 'vitest'
import { encodedImageSize } from './encodedImageSize'

function riff(chunk: string, payload: number[]): Uint8Array {
  const head = new TextEncoder().encode('RIFF')
  const webp = new TextEncoder().encode(`WEBP${chunk}`)
  return new Uint8Array([...head, 0, 0, 0, 0, ...webp, 0, 0, 0, 0, ...payload])
}

const le16 = (value: number) => [value & 0xff, value >> 8]
const le24 = (value: number) => [value & 0xff, (value >> 8) & 0xff, value >> 16]
const be16 = (value: number) => [value >> 8, value & 0xff]

describe('encodedImageSize', () => {
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

  it('reads an extended VP8X canvas', () => {
    const bytes = riff('VP8X', [
      0x10,
      0,
      0,
      0,
      ...le24(3200 - 1),
      ...le24(2133 - 1),
    ])
    expect(encodedImageSize(bytes)).toEqual({ width: 3200, height: 2133 })
  })

  it('reads a JPEG SOF after other segments and fill bytes', () => {
    const app0 = [0xff, 0xe0, ...be16(4), 0, 0]
    const dht = [0xff, 0xc4, ...be16(3), 0]
    const sof = [0xff, 0xff, 0xc2, ...be16(11), 8, ...be16(900), ...be16(1600)]
    const bytes = new Uint8Array([0xff, 0xd8, ...app0, ...dht, ...sof, 3, 0])
    expect(encodedImageSize(bytes)).toEqual({ width: 1600, height: 900 })
  })

  it('returns undefined for other or broken data', () => {
    expect(encodedImageSize(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(encodedImageSize(riff('ALPH', [0, 0, 0, 0]))).toBeUndefined()
    expect(encodedImageSize(riff('VP8L', [0x00, 0, 0, 0, 0]))).toBeUndefined()
    expect(
      encodedImageSize(new Uint8Array([0xff, 0xd8, 0x00, 0xe0, 0, 4, 0, 0, 0])),
    ).toBeUndefined()
    expect(
      encodedImageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2])),
    ).toBeUndefined()
  })
})
