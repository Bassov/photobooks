import { describe, expect, it } from 'vitest'
import {
  ADOBE_RGB_ICC,
  CAMERA_SRGB_ICC,
  colorJpeg,
  DISPLAY_P3_ICC,
} from '../testing/colorFixtures'
import {
  buildMatrixProfile,
  iccChannels,
  iccFamily,
  jpegIccProfile,
  pngDeflatedIcc,
  profileForImage,
  readSourceColor,
  RGB_PRIMARIES,
  srgbIccProfile,
} from './iccProfile'

const encode = (value: string) => [...new TextEncoder().encode(value)]

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function textAt(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

/** `[signature, offset, size]` of each tag table entry. */
function tagTable(icc: Uint8Array) {
  const view = viewOf(icc)
  return Array.from({ length: view.getUint32(128) }, (_, index) => {
    const entry = 132 + index * 12
    return [
      textAt(icc, entry, 4),
      view.getUint32(entry + 4),
      view.getUint32(entry + 8),
    ] as const
  })
}

function rgbProfile(primaries: {
  red?: readonly [number, number, number]
  green?: readonly [number, number, number]
  blue?: readonly [number, number, number]
}): Uint8Array {
  return buildMatrixProfile({
    description: 'test',
    primaries: { ...RGB_PRIMARIES.srgb, ...primaries },
    curve: { gamma: 2.2 },
  })
}

/** `icc` with its color space field set to `space`. */
function withSpace(icc: Uint8Array, space: string): Uint8Array {
  const copy = icc.slice()
  copy.set(encode(space), 16)
  return copy
}

function segment(marker: number, payload: readonly number[]): number[] {
  const length = payload.length + 2
  return [0xff, marker, length >> 8, length & 0xff, ...payload]
}

/** An APP2 ICC chunk `sequence` of `total`. */
function iccChunk(
  sequence: number,
  total: number,
  data: ArrayLike<number>,
): number[] {
  return segment(0xe2, [
    ...encode('ICC_PROFILE\0'),
    sequence,
    total,
    ...Array.from(data),
  ])
}

function jpeg(...segments: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flat()])
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function pngChunk(type: string, data: readonly number[]): number[] {
  const length = data.length
  return [
    length >>> 24,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...encode(type),
    ...data,
    0,
    0,
    0,
    0,
  ]
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** A PNG of chunks only (no valid image), `iCCP` after the header when given. */
function png(iccp?: readonly number[], beforeIdat = true): Uint8Array {
  const profile = iccp === undefined ? [] : pngChunk('iCCP', iccp)
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...pngChunk(
      'IHDR',
      Array.from({ length: 13 }, () => 1),
    ),
    ...(beforeIdat ? profile : []),
    ...pngChunk('IDAT', [1, 2, 3]),
    ...(beforeIdat ? [] : profile),
    ...pngChunk('IEND', []),
  ])
}

describe('jpegIccProfile', () => {
  it('reads a one-chunk profile as is', () => {
    expect(jpegIccProfile(colorJpeg('one', ADOBE_RGB_ICC))).toEqual(
      ADOBE_RGB_ICC,
    )
  })

  it('joins chunks in sequence order, an empty one included', () => {
    const icc = ADOBE_RGB_ICC

    expect(
      jpegIccProfile(
        jpeg(
          iccChunk(2, 3, icc.subarray(100)),
          iccChunk(3, 3, []),
          iccChunk(1, 3, icc.subarray(0, 100)),
        ),
      ),
    ).toEqual(icc)
    expect(
      jpegIccProfile(colorJpeg('many', DISPLAY_P3_ICC, { chunk: 100 })),
    ).toEqual(DISPLAY_P3_ICC)
  })

  it('has none for an untagged JPEG, a missing chunk or another file', () => {
    const icc = ADOBE_RGB_ICC

    expect(jpegIccProfile(colorJpeg('plain'))).toBeUndefined()
    expect(
      jpegIccProfile(jpeg(iccChunk(1, 3, icc), iccChunk(2, 3, icc))),
    ).toBeUndefined()
    expect(jpegIccProfile(jpeg(iccChunk(1, 0, icc)))).toBeUndefined()
    expect(jpegIccProfile(new Uint8Array([0xff, 0xd8]))).toBeUndefined()
    expect(jpegIccProfile(new Uint8Array())).toBeUndefined()
  })

  it('needs the JPEG start and a chunk in an APP2 ICC segment', () => {
    const tagged = colorJpeg('one', ADOBE_RGB_ICC)
    const app1 = segment(0xe1, iccChunk(1, 1, ADOBE_RGB_ICC).slice(4))
    const other = segment(0xe2, [...encode('ICC_PROFILE?'), 1, 1, 9])

    expect(jpegIccProfile(tagged.with(0, 0xfe))).toBeUndefined()
    expect(jpegIccProfile(tagged.with(1, 0xd9))).toBeUndefined()
    expect(jpegIccProfile(jpeg(app1))).toBeUndefined()
    expect(jpegIccProfile(jpeg(other))).toBeUndefined()
  })

  it('skips a chunk too short for its sequence number', () => {
    const icc = ADOBE_RGB_ICC
    const headOnly = segment(0xe2, encode('ICC_PROFILE\0'))

    expect(jpegIccProfile(jpeg(iccChunk(1, 1, icc), headOnly))).toEqual(icc)
  })

  it('stops at the image data, the end or a byte that is no marker', () => {
    const chunk = iccChunk(1, 1, ADOBE_RGB_ICC)

    for (const stop of [
      [0xff, 0xda, 0, 2],
      [0xff, 0xd9],
      [0x00, 0x00, 0x00, 0x02],
    ]) {
      expect(jpegIccProfile(jpeg(stop, chunk)), String(stop)).toBeUndefined()
    }
  })

  it('reads a chunk ending the file, not one cut short', () => {
    const chunk = iccChunk(1, 1, ADOBE_RGB_ICC)

    expect(jpegIccProfile(jpeg(chunk))).toEqual(ADOBE_RGB_ICC)
    expect(jpegIccProfile(jpeg(chunk.slice(0, -1)))).toBeUndefined()
  })

  it('steps over a segment claiming less than its length field', () => {
    expect(
      jpegIccProfile(jpeg([0xff, 0xe1, 0, 0], iccChunk(1, 1, ADOBE_RGB_ICC))),
    ).toEqual(ADOBE_RGB_ICC)
  })
})

describe('pngDeflatedIcc', () => {
  it('reads the iCCP chunk after its name and method', async () => {
    const deflated = await deflate(ADOBE_RGB_ICC)

    expect(pngDeflatedIcc(png([...encode('ICC'), 0, 0, ...deflated]))).toEqual(
      deflated,
    )
    expect(pngDeflatedIcc(png([65, 0, 0, 7, 8]))).toEqual(
      new Uint8Array([7, 8]),
    )
  })

  it('has none without a name, with another method or after IDAT', () => {
    const valid = png([65, 0, 0, 7, 8])

    expect(pngDeflatedIcc(png())).toBeUndefined()
    expect(pngDeflatedIcc(png([0, 0, 1, 2]))).toBeUndefined()
    expect(pngDeflatedIcc(png([65, 66]))).toBeUndefined()
    expect(pngDeflatedIcc(png([65, 0, 1, 2]))).toBeUndefined()
    expect(pngDeflatedIcc(png([65, 0, 0, 7, 8], false))).toBeUndefined()
    expect(pngDeflatedIcc(valid.with(1, 0))).toBeUndefined()
    expect(pngDeflatedIcc(valid.with(7, 0))).toBeUndefined()
    expect(pngDeflatedIcc(colorJpeg('jpeg'))).toBeUndefined()
  })

  it('reads a chunk ending the file, not one running past it', () => {
    // Signature, IHDR (25 bytes), iCCP head and 5 data bytes; CRC cut off.
    const full = png([65, 0, 0, 7, 8]).subarray(0, 8 + 25 + 8 + 5)

    expect(pngDeflatedIcc(full)).toEqual(new Uint8Array([7, 8]))
    expect(pngDeflatedIcc(full.subarray(0, -1))).toBeUndefined()
    expect(pngDeflatedIcc(new Uint8Array(PNG_SIGNATURE))).toBeUndefined()
  })
})

describe('iccChannels', () => {
  it('counts the components of the profile color space', () => {
    expect(iccChannels(ADOBE_RGB_ICC)).toBe(3)
    expect(iccChannels(withSpace(ADOBE_RGB_ICC, 'GRAY'))).toBe(1)
    expect(iccChannels(withSpace(ADOBE_RGB_ICC, 'CMYK'))).toBe(4)
    expect(iccChannels(withSpace(ADOBE_RGB_ICC, 'Lab '))).toBeUndefined()
  })

  it('takes a header-only profile, not a shorter or cut one', () => {
    const headerOnly = ADOBE_RGB_ICC.slice(0, 132)
    viewOf(headerOnly).setUint32(0, 132)
    const tooSmall = headerOnly.slice()
    viewOf(tooSmall).setUint32(0, 131)

    expect(iccChannels(headerOnly)).toBe(3)
    expect(iccChannels(tooSmall)).toBeUndefined()
    expect(iccChannels(ADOBE_RGB_ICC.subarray(0, 200))).toBeUndefined()
    expect(iccChannels(ADOBE_RGB_ICC.with(36, 0))).toBeUndefined()
    expect(iccChannels(new Uint8Array())).toBeUndefined()
  })
})

describe('iccFamily', () => {
  it('tells the RGB space by its colorants', () => {
    expect(iccFamily(srgbIccProfile())).toBe('srgb')
    expect(iccFamily(CAMERA_SRGB_ICC)).toBe('srgb')
    expect(iccFamily(ADOBE_RGB_ICC)).toBe('adobe-rgb')
    expect(iccFamily(DISPLAY_P3_ICC)).toBe('display-p3')
    expect(iccFamily(withSpace(ADOBE_RGB_ICC, 'GRAY'))).toBe('other')
  })

  it('needs every component of every colorant to match', () => {
    const { red, green, blue } = RGB_PRIMARIES.srgb
    const off = (xyz: readonly [number, number, number], index: number) =>
      xyz.map((value, at) => (at === index ? value + 0.05 : value)) as [
        number,
        number,
        number,
      ]

    for (const index of [0, 1, 2]) {
      expect(iccFamily(rgbProfile({ red: off(red, index) }))).toBe('other-rgb')
      expect(iccFamily(rgbProfile({ green: off(green, index) }))).toBe(
        'other-rgb',
      )
      expect(iccFamily(rgbProfile({ blue: off(blue, index) }))).toBe(
        'other-rgb',
      )
    }
  })

  it('takes colorants a little off the standard values', () => {
    const shifted = RGB_PRIMARIES['display-p3'].red.map(
      (value) => value + 0.009,
    ) as [number, number, number]

    expect(iccFamily(rgbProfile({ red: [0.4361, 0.2225, 0.0139] }))).toBe(
      'srgb',
    )
    expect(
      iccFamily(
        buildMatrixProfile({
          description: 'P3',
          primaries: { ...RGB_PRIMARIES['display-p3'], red: shifted },
          curve: { gamma: 2.2 },
        }),
      ),
    ).toBe('display-p3')
  })

  it('is other RGB without colorant tags or with a broken one', () => {
    const icc = ADOBE_RGB_ICC
    const renamed = icc.slice()
    for (const [index, [signature]] of tagTable(icc).entries()) {
      if (signature === 'gXYZ') renamed.set(encode('xxxx'), 132 + index * 12)
    }
    const [, redAt = 0] =
      tagTable(icc).find(([signature]) => signature === 'rXYZ') ?? []
    const broken = icc.slice()
    broken.set(encode('xyz '), redAt)
    const fewerTags = icc.slice()
    viewOf(fewerTags).setUint32(128, 4)
    // A missing tag in a table claiming 4 billion entries: bounded search.
    const manyTags = renamed.slice()
    viewOf(manyTags).setUint32(128, 0xffffffff)

    expect(iccFamily(renamed)).toBe('other-rgb')
    expect(iccFamily(broken)).toBe('other-rgb')
    expect(iccFamily(fewerTags)).toBe('other-rgb')
    expect(iccFamily(manyTags)).toBe('other-rgb')
  })
})

describe('readSourceColor', () => {
  it('reads tagged JPEGs and PNGs', async () => {
    const deflated = await deflate(DISPLAY_P3_ICC)
    const tagged = png([...encode('P3'), 0, 0, ...deflated])

    await expect(
      readSourceColor(colorJpeg('adobe', ADOBE_RGB_ICC)),
    ).resolves.toEqual({ icc: ADOBE_RGB_ICC, family: 'adobe-rgb' })
    await expect(readSourceColor(tagged)).resolves.toEqual({
      icc: DISPLAY_P3_ICC,
      family: 'display-p3',
    })
  })

  it('counts untagged, broken or undecodable profiles as sRGB', async () => {
    const untagged = { icc: undefined, family: 'srgb' }

    await expect(readSourceColor(colorJpeg('plain'))).resolves.toEqual(untagged)
    await expect(readSourceColor(png())).resolves.toEqual(untagged)
    await expect(readSourceColor(png([65, 0, 0, 1, 2, 3]))).resolves.toEqual(
      untagged,
    )
    await expect(
      readSourceColor(colorJpeg('broken', ADOBE_RGB_ICC.subarray(0, 100))),
    ).resolves.toEqual(untagged)
  })
})

describe('profileForImage', () => {
  it('keeps a matching profile, else tags RGB as sRGB', () => {
    const gray = withSpace(ADOBE_RGB_ICC, 'GRAY')

    expect(profileForImage(ADOBE_RGB_ICC, 3)).toBe(ADOBE_RGB_ICC)
    expect(profileForImage(gray, 1)).toBe(gray)
    expect(profileForImage(gray, 3)).toEqual(srgbIccProfile())
    expect(profileForImage(undefined, 3)).toEqual(srgbIccProfile())
    expect(profileForImage(undefined, 1)).toBeUndefined()
    expect(profileForImage(ADOBE_RGB_ICC, 4)).toBeUndefined()
  })
})

describe('buildMatrixProfile', () => {
  it('writes the sRGB profile as an ICC v2 display profile', () => {
    const icc = srgbIccProfile()
    const view = viewOf(icc)

    expect(icc.length).toBe(2528)
    expect(view.getUint32(0)).toBe(2528)
    expect(view.getUint32(8)).toBe(0x02100000)
    expect(textAt(icc, 12, 12)).toBe('mntrRGB XYZ ')
    expect([24, 26, 28].map((at) => view.getUint16(at))).toEqual([2026, 1, 1])
    expect(textAt(icc, 36, 4)).toBe('acsp')
    expect([68, 72, 76].map((at) => view.getInt32(at))).toEqual([
      63190, 65536, 54061,
    ])
    // desc, cprt, wtpt, r/g/b XYZ on 4-byte offsets, three TRCs on one curve.
    expect(tagTable(icc)).toEqual([
      ['desc', 240, 109],
      ['cprt', 352, 33],
      ['wtpt', 388, 20],
      ['rXYZ', 408, 20],
      ['gXYZ', 428, 20],
      ['bXYZ', 448, 20],
      ['rTRC', 468, 2060],
      ['gTRC', 468, 2060],
      ['bTRC', 468, 2060],
    ])
    expect(textAt(icc, 240, 4)).toBe('desc')
    expect(view.getUint32(248)).toBe(18)
    expect(textAt(icc, 252, 18)).toBe('sRGB IEC61966-2.1\0')
    expect(textAt(icc, 352, 4)).toBe('text')
    expect(textAt(icc, 360, 25)).toBe('No copyright, use freely\0')
    expect(textAt(icc, 388, 4)).toBe('XYZ ')
    expect([396, 400, 404].map((at) => view.getInt32(at))).toEqual([
      63190, 65536, 54061,
    ])
    expect([416, 420, 424].map((at) => view.getInt32(at))).toEqual([
      28580, 14582, 911,
    ])
  })

  it('writes the sRGB tone curve as a 1024-entry table', () => {
    const icc = srgbIccProfile()
    const view = viewOf(icc)
    const point = (index: number) => view.getUint16(468 + 12 + index * 2)

    expect(textAt(icc, 468, 4)).toBe('curv')
    expect(view.getUint32(476)).toBe(1024)
    expect(point(0)).toBe(0)
    // Linear toe, then the 2.4 power segment, ending at white.
    expect(point(10)).toBe(Math.round((10 / 1023 / 12.92) * 65535))
    expect(point(41)).toBe(Math.round((41 / 1023 / 12.92) * 65535))
    expect(point(512)).toBe(
      Math.round(((512 / 1023 + 0.055) / 1.055) ** 2.4 * 65535),
    )
    expect(point(1023)).toBe(65535)
  })

  it('writes a gamma curve as one u8Fixed8 value', () => {
    const icc = rgbProfile({})
    const view = viewOf(icc)
    const [, curve = 0, size] =
      tagTable(icc).find(([signature]) => signature === 'rTRC') ?? []

    expect(size).toBe(14)
    expect(view.getUint32(curve + 8)).toBe(1)
    expect(view.getUint16(curve + 12)).toBe(563)
  })
})
