import { describe, expect, it } from 'vitest'
import { lumaPlane, maxBandStep, meanSsim } from './metrics'

const C1 = (0.01 * 255) ** 2
const C2 = (0.03 * 255) ** 2

/** Luma plane `width`×`height` from `value(x, y)`. */
function plane(
  width: number,
  height: number,
  value: (x: number, y: number) => number,
): Float32Array {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = value(x, y)
    }
  }
  return out
}

describe('lumaPlane', () => {
  it('weights R, G, B by BT.601 and ignores alpha', () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255, 10, 20, 30, 255,
    ])

    const luma = lumaPlane(rgba)

    expect(luma).toHaveLength(4)
    expect(luma[0]).toBeCloseTo(76.245, 3)
    expect(luma[1]).toBeCloseTo(149.685, 3)
    expect(luma[2]).toBeCloseTo(29.07, 3)
    expect(luma[3]).toBeCloseTo(18.15, 3)
  })
})

describe('meanSsim', () => {
  it('is 1 for identical planes', () => {
    const a = plane(24, 16, (x, y) => (x * 7 + y * 13) % 255)

    expect(meanSsim(a, a, 24, 16)).toBeCloseTo(1, 10)
  })

  it('scores one 8 px window by luminance, contrast and structure', () => {
    const a = plane(8, 8, () => 100)
    const b = plane(8, 8, () => 110)

    const expected = (2 * 100 * 110 + C1) / (100 ** 2 + 110 ** 2 + C1)
    expect(meanSsim(a, b, 8, 8)).toBeCloseTo(expected, 10)
  })

  it('averages windows at a 4 px stride', () => {
    const a = plane(12, 8, () => 100)
    const b = plane(12, 8, (x) => (x >= 8 ? 110 : 100))

    // Window x 0–7 is identical; window x 4–11 holds four 100 and four 110 columns.
    const luminance = (2 * 100 * 105 + C1) / (100 ** 2 + 105 ** 2 + C1)
    const contrast = C2 / (25 + C2)
    expect(meanSsim(a, b, 12, 8)).toBeCloseTo(
      (1 + luminance * contrast) / 2,
      10,
    )
  })

  it('drops as noise grows and is symmetric', () => {
    const a = plane(32, 32, (x, y) => 60 + ((x * 31 + y * 17) % 40))
    const noise = (amp: number) =>
      plane(
        32,
        32,
        (x, y) => (a[y * 32 + x] ?? 0) + (((x + y) % 2) * 2 - 1) * amp,
      )
    const light = noise(2)
    const heavy = noise(12)

    expect(meanSsim(a, light, 32, 32)).toBeLessThan(1)
    expect(meanSsim(a, heavy, 32, 32)).toBeLessThan(meanSsim(a, light, 32, 32))
    expect(meanSsim(heavy, a, 32, 32)).toBeCloseTo(
      meanSsim(a, heavy, 32, 32),
      10,
    )
  })

  it.each([
    [7, 8],
    [8, 7],
  ])('throws when a %i×%i plane fits no window', (width, height) => {
    const a = plane(width, height, () => 0)

    expect(() => meanSsim(a, a, width, height)).toThrow(
      'SSIM needs at least 8 px per side',
    )
  })
})

describe('maxBandStep', () => {
  it('is 0 for identical planes and for a uniform offset', () => {
    const a = plane(48, 32, (x, y) => x + y)
    const shifted = plane(48, 32, (x, y) => x + y + 3)

    expect(maxBandStep(a, a, 48, 32)).toBe(0)
    expect(maxBandStep(a, shifted, 48, 32)).toBeCloseTo(0, 5)
  })

  it('reports a step between horizontal neighbours', () => {
    const a = plane(32, 16, () => 50)
    const b = plane(32, 16, (x) => (x >= 16 ? 52 : 50))

    expect(maxBandStep(a, b, 32, 16)).toBeCloseTo(2, 5)
  })

  it('reports a step between vertical neighbours', () => {
    const a = plane(16, 32, () => 50)
    const b = plane(16, 32, (_x, y) => (y >= 16 ? 47 : 50))

    expect(maxBandStep(a, b, 16, 32)).toBeCloseTo(3, 5)
  })

  it('averages a partial edge block over its own pixels', () => {
    const a = plane(20, 16, () => 50)
    const b = plane(20, 16, (x) => (x >= 16 ? 54 : 50))

    expect(maxBandStep(a, b, 20, 16)).toBeCloseTo(4, 5)
  })

  it('averages a partial bottom block over its own rows', () => {
    const a = plane(16, 20, () => 50)
    const b = plane(16, 20, (_x, y) => (y >= 16 ? 54 : 50))

    expect(maxBandStep(a, b, 16, 20)).toBeCloseTo(4, 5)
  })

  it('does not wrap the last block of a row onto the next row', () => {
    // 3 × 2 blocks: +2 at (row 0, col 2), −2 at (row 1, col 0).
    const a = plane(48, 32, () => 100)
    const b = plane(48, 32, (x, y) => {
      if (y < 16 && x >= 32) return 98
      if (y >= 16 && x < 16) return 102
      return 100
    })

    expect(maxBandStep(a, b, 48, 32)).toBeCloseTo(2, 5)
  })
})
