import { describe, expect, it } from 'vitest'
import {
  fixturePixels,
  LAB_FIXTURES,
  LAB_SOURCE,
  type LabFixture,
} from './fixtures'
import { lumaPlane } from './metrics'

const W = 64
const H = 48

/** FNV-1a over the raster: any change to a fixture formula changes it. */
function checksum(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (const byte of bytes) {
    h = Math.imul(h ^ byte, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function meanLuma(kind: LabFixture, rows: [number, number]): number {
  const luma = lumaPlane(fixturePixels(kind, W, H))
  let sum = 0
  for (let y = rows[0]; y < rows[1]; y++) {
    for (let x = 0; x < W; x++) {
      sum += luma[y * W + x] ?? 0
    }
  }
  return sum / ((rows[1] - rows[0]) * W)
}

function channelMean(kind: LabFixture, channel: number): number {
  const rgba = fixturePixels(kind, W, H)
  let sum = 0
  for (let i = channel; i < rgba.length; i += 4) {
    sum += rgba[i] ?? 0
  }
  return sum / (W * H)
}

describe('lab fixtures', () => {
  it('lists sky, shadows and foliage at a source above the 3200 px edge', () => {
    expect(LAB_FIXTURES).toEqual(['sky', 'shadows', 'foliage'])
    expect(LAB_SOURCE).toEqual({ width: 4000, height: 3000 })
  })

  it.each(LAB_FIXTURES)('%s is an opaque, deterministic raster', (kind) => {
    const first = fixturePixels(kind, W, H)

    expect(first).toHaveLength(W * H * 4)
    expect(first.filter((_, i) => i % 4 === 3).every((a) => a === 255)).toBe(
      true,
    )
    expect(fixturePixels(kind, W, H)).toEqual(first)
  })

  it('pins every fixture formula', () => {
    // 100 × 100: the shadows box edges (55 %, 80 %, 85 %) fall on whole pixels.
    expect(
      Object.fromEntries(
        LAB_FIXTURES.map((kind) => [
          kind,
          checksum(fixturePixels(kind, 100, 100)),
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "foliage": "7a27f04d",
        "shadows": "6f406a2",
        "sky": "cdd4e34e",
      }
    `)
  })

  it('sky brightens from a blue zenith to the horizon', () => {
    expect(meanLuma('sky', [0, 8])).toBeLessThan(meanLuma('sky', [40, 48]) - 60)
    expect(channelMean('sky', 2)).toBeGreaterThan(channelMean('sky', 0))
  })

  it('shadows stay low-key', () => {
    expect(meanLuma('shadows', [0, H])).toBeLessThan(20)
  })

  it('foliage is green with fine detail', () => {
    const luma = lumaPlane(fixturePixels('foliage', W, H))
    let steps = 0
    for (let i = 1; i < luma.length; i++) {
      steps += Math.abs((luma[i] ?? 0) - (luma[i - 1] ?? 0))
    }
    expect(channelMean('foliage', 1)).toBeGreaterThan(channelMean('foliage', 0))
    expect(steps / luma.length).toBeGreaterThan(5)
  })
})
