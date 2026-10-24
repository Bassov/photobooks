import { describe, expect, it, vi } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  HEIC_UNSUPPORTED_MESSAGE,
  fileHasHeicSignature,
  hasFileExtension,
  isHeicByName,
  isHeicLikeFile,
  isHeicMime,
  isHeicSignature,
  isHeicSniffCandidate,
  isKnownHeicFile,
  markHeicFile,
  upgradeRejectedWithHeicSniff,
} from './heic'

function ftypBox(major: string, compat: string[] = []): Uint8Array {
  const size = 16 + compat.length * 4
  const bytes = new Uint8Array(size)
  bytes[0] = (size >>> 24) & 0xff
  bytes[1] = (size >>> 16) & 0xff
  bytes[2] = (size >>> 8) & 0xff
  bytes[3] = size & 0xff
  bytes.set([0x66, 0x74, 0x79, 0x70], 4) // ftyp
  for (let i = 0; i < 4; i += 1) {
    bytes[8 + i] = major.charCodeAt(i)
  }
  compat.forEach((brand, index) => {
    const offset = 16 + index * 4
    for (let i = 0; i < 4; i += 1) {
      bytes[offset + i] = brand.charCodeAt(i)
    }
  })
  return bytes
}

describe('isHeicByName', () => {
  it('matches .heic/.heif case-insensitively', () => {
    expect(isHeicByName('scan.HEIC')).toBe(true)
    expect(isHeicByName('a.heif')).toBe(true)
    expect(isHeicByName('a.jpg')).toBe(false)
    expect(isHeicByName('heic')).toBe(false)
  })
})

describe('isHeicMime', () => {
  it.each([
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
    'IMAGE/HEIC',
  ])('matches %s', (mime) => {
    expect(isHeicMime(mime)).toBe(true)
  })

  it('rejects jpeg/png/empty', () => {
    expect(isHeicMime('image/jpeg')).toBe(false)
    expect(isHeicMime('image/png')).toBe(false)
    expect(isHeicMime('')).toBe(false)
  })
})

describe('markHeicFile / isKnownHeicFile', () => {
  it('treats sniff-marked octet-stream files as HEIC', () => {
    const file = new File([new Uint8Array([1])], 'IMG_0042', {
      type: 'application/octet-stream',
    })
    expect(isKnownHeicFile(file)).toBe(false)
    markHeicFile(file)
    expect(isKnownHeicFile(file)).toBe(true)
    expect(isHeicLikeFile(file)).toBe(false)
  })
})

describe('isHeicLikeFile', () => {
  it('detects HEIC by mime and extension', () => {
    expect(
      isHeicLikeFile({ name: 'scan.HEIC', type: 'application/octet-stream' }),
    ).toBe(true)
    expect(isHeicLikeFile({ name: 'a.heif', type: '' })).toBe(true)
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/heic' })).toBe(true)
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false)
  })
})

describe('hasFileExtension', () => {
  it('requires a non-empty extension after a mid-name dot', () => {
    expect(hasFileExtension('IMG_0042')).toBe(false)
    expect(hasFileExtension('.hidden')).toBe(false)
    expect(hasFileExtension('trailing.')).toBe(false)
    expect(hasFileExtension('a.heic')).toBe(true)
    expect(hasFileExtension('a.b.c')).toBe(true)
  })
})

describe('isHeicSniffCandidate', () => {
  it('skips already-tagged HEIC and typed MIME rejects', () => {
    expect(
      isHeicSniffCandidate(
        { name: 'x', type: 'application/octet-stream' },
        'heic',
      ),
    ).toBe(false)
    expect(
      isHeicSniffCandidate(
        { name: 'x', type: 'image/tiff' },
        'unsupported-type',
      ),
    ).toBe(false)
  })

  it('accepts empty or octet-stream without extension', () => {
    expect(
      isHeicSniffCandidate({ name: 'IMG', type: '' }, 'unsupported-type'),
    ).toBe(true)
    expect(
      isHeicSniffCandidate(
        { name: 'IMG', type: 'application/octet-stream' },
        'unsupported-type',
      ),
    ).toBe(true)
    expect(
      isHeicSniffCandidate(
        { name: 'a.bin', type: 'application/octet-stream' },
        'unsupported-type',
      ),
    ).toBe(false)
  })
})

describe('isHeicSignature', () => {
  it.each(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])(
    'matches major brand %s',
    (brand) => {
      expect(isHeicSignature(ftypBox(brand))).toBe(true)
    },
  )

  it('matches compatible brand when major is not HEIC', () => {
    expect(isHeicSignature(ftypBox('isom', ['heic']))).toBe(true)
    expect(isHeicSignature(ftypBox('isom', ['mp41', 'mif1']))).toBe(true)
  })

  it('rejects ftyp without HEIC brands', () => {
    expect(isHeicSignature(ftypBox('isom', ['mp41']))).toBe(false)
    expect(isHeicSignature(ftypBox('isom'))).toBe(false)
  })

  it('rejects short buffers and non-ftyp', () => {
    expect(isHeicSignature(new Uint8Array(8))).toBe(false)
    expect(isHeicSignature(new Uint8Array(11))).toBe(false)
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
    expect(isHeicSignature(jpeg)).toBe(false)
  })

  it('accepts a minimal 12-byte ftyp+heic box', () => {
    const bytes = new Uint8Array(12)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x68, 0x65, 0x69, 0x63], 8)
    expect(isHeicSignature(bytes)).toBe(true)
  })

  it('rejects when any ftyp byte is wrong even if major is heic', () => {
    for (const index of [4, 5, 6, 7] as const) {
      const bytes = ftypBox('heic')
      bytes[index] = 0x00
      expect(isHeicSignature(bytes)).toBe(false)
    }
  })

  it('reads ArrayBuffer and ArrayBufferView the same', () => {
    const box = ftypBox('heic')
    const copy = box.buffer.slice(
      box.byteOffset,
      box.byteOffset + box.byteLength,
    )
    expect(isHeicSignature(copy as ArrayBuffer)).toBe(true)
    expect(isHeicSignature(box.subarray(0))).toBe(true)
  })

  test.prop([fc.uint8Array({ minLength: 0, maxLength: 64 })])(
    'random bytes never false-positive without ftyp+HEIC brand',
    (raw) => {
      const bytes = new Uint8Array(raw)
      const isFtyp =
        bytes.byteLength >= 12 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
      if (!isFtyp) {
        expect(isHeicSignature(bytes)).toBe(false)
        return
      }
      const brandAt = (offset: number): string | null => {
        if (offset + 4 > bytes.byteLength) {
          return null
        }
        return String.fromCharCode(
          bytes.at(offset) ?? 0,
          bytes.at(offset + 1) ?? 0,
          bytes.at(offset + 2) ?? 0,
          bytes.at(offset + 3) ?? 0,
        )
      }
      const brands: string[] = []
      const major = brandAt(8)
      if (major !== null) {
        brands.push(major)
      }
      for (let offset = 16; offset + 4 <= bytes.byteLength; offset += 4) {
        const brand = brandAt(offset)
        if (brand !== null) {
          brands.push(brand)
        }
      }
      const heicBrands = new Set([
        'heic',
        'heix',
        'hevc',
        'hevx',
        'heim',
        'heis',
        'mif1',
        'msf1',
      ])
      const expectTrue = brands.some((b) => heicBrands.has(b))
      expect(isHeicSignature(bytes)).toBe(expectTrue)
    },
  )
})

describe('fileHasHeicSignature', () => {
  it('sniffs only the first 32 bytes', async () => {
    const heicHead = ftypBox('heic')
    const padded = new Uint8Array(64)
    padded.set(heicHead)
    const file = new File([padded], 'IMG', { type: 'application/octet-stream' })
    const sliceSpy = vi.spyOn(file, 'slice')
    await expect(fileHasHeicSignature(file)).resolves.toBe(true)
    expect(sliceSpy).toHaveBeenCalledWith(0, 32)
  })

  it('returns false for non-HEIC heads', async () => {
    const file = new File([new Uint8Array(32)], 'IMG', {
      type: 'application/octet-stream',
    })
    await expect(fileHasHeicSignature(file)).resolves.toBe(false)
  })
})

describe('upgradeRejectedWithHeicSniff', () => {
  async function mapAll<U>(
    items: readonly U[],
    _limit: number,
    fn: (item: U) => Promise<void>,
  ): Promise<void> {
    for (const item of items) {
      await fn(item)
    }
  }

  it('returns the same list when nothing needs sniffing', async () => {
    const heic = new File([new Uint8Array([1])], 'a.heic', {
      type: 'image/heic',
    })
    const rejected = [
      {
        file: heic,
        message: 'x',
        reason: 'heic',
      },
    ]
    const out = await upgradeRejectedWithHeicSniff(rejected, mapAll, 4)
    expect(out).toEqual(rejected)
  })

  it('upgrades extension-less HEIC octet-stream rejects', async () => {
    const heicFile = new File(
      [ftypBox('heic').buffer as ArrayBuffer],
      'IMG_0042',
      {
        type: 'application/octet-stream',
      },
    )
    const junk = new File([new ArrayBuffer(20)], 'OTHER', {
      type: 'application/octet-stream',
    })
    const rejected = [
      {
        file: heicFile,
        message: 'Unsupported image format: application/octet-stream',
        reason: 'unsupported-type',
      },
      {
        file: junk,
        message: 'Unsupported image format: application/octet-stream',
        reason: 'unsupported-type',
      },
    ]
    const out = await upgradeRejectedWithHeicSniff(rejected, mapAll, 4)
    expect(out[0]?.reason).toBe('heic')
    expect(out[0]?.message).toBe(HEIC_UNSUPPORTED_MESSAGE)
    expect(out[1]?.reason).toBe('unsupported-type')
  })

  it('leaves the list unchanged when sniff finds no HEIC', async () => {
    const junk = new File([new Uint8Array(20)], 'OTHER', {
      type: '',
    })
    const rejected = [
      {
        file: junk,
        message: 'Unsupported',
        reason: 'unsupported-type',
      },
    ]
    const out = await upgradeRejectedWithHeicSniff(rejected, mapAll, 4)
    expect(out).toEqual(rejected)
  })
})

describe('HEIC_UNSUPPORTED_MESSAGE', () => {
  it('mentions JPEG export and iPhone Formats', () => {
    expect(HEIC_UNSUPPORTED_MESSAGE).toContain("HEIC isn't supported yet")
    expect(HEIC_UNSUPPORTED_MESSAGE).toContain('JPEG')
    expect(HEIC_UNSUPPORTED_MESSAGE).toContain('Most Compatible')
  })
})
