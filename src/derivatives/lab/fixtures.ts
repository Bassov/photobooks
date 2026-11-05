/**
 * Generated hard fixtures for the derivative lab: deterministic RGBA rasters
 * (no binaries in the repo), each aimed at one encoder weakness.
 */

export type LabFixture = 'sky' | 'shadows' | 'foliage'

/** Sky gradient (banding), deep shadows (crushed blacks), foliage (detail). */
export const LAB_FIXTURES: readonly LabFixture[] = ['sky', 'shadows', 'foliage']

/** Source raster size: above the 3200 px edge so every candidate downsizes. */
export const LAB_SOURCE = { width: 4000, height: 3000 } as const

/** Integer lattice hash in [0, 1). */
function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000
}

/** Sensor-like grain, triangular in (-amp, amp). */
function grain(x: number, y: number, seed: number, amp: number): number {
  return (hash01(x, y, seed) + hash01(x, y, seed + 1) - 1) * amp
}

/** Bilinear value noise in [0, 1) with a `cell` px lattice. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  const fx = x / cell - gx
  const fy = y / cell - gy
  const top = hash01(gx, gy, seed) * (1 - fx) + hash01(gx + 1, gy, seed) * fx
  const bottom =
    hash01(gx, gy + 1, seed) * (1 - fx) + hash01(gx + 1, gy + 1, seed) * fx
  return top * (1 - fy) + bottom * fy
}

type Rgb = [number, number, number]

/** Zenith blue to a pale horizon, warm glow low on the right, light grain. */
function skyPixel(x: number, y: number, width: number, height: number): Rgb {
  const t = y / height
  const dx = (x - width * 0.8) / width
  const dy = (y - height) / height
  const glow = Math.exp(-(dx * dx + dy * dy) * 6) * 40
  const n = grain(x, y, 11, 4)
  return [
    40 + 150 * t + glow + n,
    90 + 120 * t + glow * 0.6 + n,
    160 + 70 * t + n,
  ]
}

/** Low-key room: soft pool of light, a dim edge-on box, shadow noise. */
function shadowsPixel(
  x: number,
  y: number,
  width: number,
  height: number,
): Rgb {
  const dx = (x - width * 0.35) / width
  const dy = (y - height * 0.4) / height
  const pool = Math.exp(-(dx * dx + dy * dy) * 9) * 34
  const box =
    x > width * 0.55 && x < width * 0.8 && y > height * 0.5 && y < height * 0.85
      ? 7
      : 0
  const n = grain(x, y, 23, 5)
  const v = 3 + pool + box + n
  return [v * 1.05, v, v * 0.9]
}

/** Leaves: four octaves of value noise down to 3 px, specular glints. */
function foliagePixel(x: number, y: number): Rgb {
  const detail =
    valueNoise(x, y, 3, 31) * 0.35 +
    valueNoise(x, y, 9, 37) * 0.3 +
    valueNoise(x, y, 27, 41) * 0.2 +
    valueNoise(x, y, 81, 43) * 0.15
  const glint = hash01(x, y, 47) > 0.997 ? 90 : 0
  const g = 25 + 190 * detail * detail + glint
  return [g * 0.5 + glint * 0.5, g, g * 0.3 + glint * 0.3]
}

/** RGBA pixels of fixture `kind` at `width`×`height` (opaque). */
export function fixturePixels(
  kind: LabFixture,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] =
        kind === 'sky'
          ? skyPixel(x, y, width, height)
          : kind === 'shadows'
            ? shadowsPixel(x, y, width, height)
            : foliagePixel(x, y)
      const o = (y * width + x) * 4
      rgba[o] = r
      rgba[o + 1] = g
      rgba[o + 2] = b
      rgba[o + 3] = 255
    }
  }
  return rgba
}
