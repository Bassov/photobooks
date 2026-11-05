/** Pure image-quality metrics for the derivative lab (8-bit luma planes). */

/** BT.601 luma of an RGBA buffer, one float per pixel. */
export function lumaPlane(rgba: Uint8ClampedArray): Float32Array {
  const luma = new Float32Array(rgba.length / 4)
  for (let i = 0; i < luma.length; i++) {
    const o = i * 4
    luma[i] =
      0.299 * (rgba[o] ?? 0) +
      0.587 * (rgba[o + 1] ?? 0) +
      0.114 * (rgba[o + 2] ?? 0)
  }
  return luma
}

const SSIM_C1 = (0.01 * 255) ** 2
const SSIM_C2 = (0.03 * 255) ** 2

/** SSIM window edge and stride in px. */
const SSIM_WINDOW = 8
const SSIM_STRIDE = 4

function windowSsim(
  a: Float32Array,
  b: Float32Array,
  width: number,
  x0: number,
  y0: number,
): number {
  let sumA = 0
  let sumB = 0
  let sumAA = 0
  let sumBB = 0
  let sumAB = 0
  for (let y = y0; y < y0 + SSIM_WINDOW; y++) {
    for (let x = x0; x < x0 + SSIM_WINDOW; x++) {
      const va = a[y * width + x] ?? 0
      const vb = b[y * width + x] ?? 0
      sumA += va
      sumB += vb
      sumAA += va * va
      sumBB += vb * vb
      sumAB += va * vb
    }
  }
  const n = SSIM_WINDOW * SSIM_WINDOW
  const meanA = sumA / n
  const meanB = sumB / n
  const varA = sumAA / n - meanA * meanA
  const varB = sumBB / n - meanB * meanB
  const cov = sumAB / n - meanA * meanB
  return (
    ((2 * meanA * meanB + SSIM_C1) * (2 * cov + SSIM_C2)) /
    ((meanA * meanA + meanB * meanB + SSIM_C1) * (varA + varB + SSIM_C2))
  )
}

/**
 * Mean SSIM of two equal-size luma planes over 8 px windows at a 4 px
 * stride (1 = identical). Throws when no window fits.
 */
export function meanSsim(
  a: Float32Array,
  b: Float32Array,
  width: number,
  height: number,
): number {
  if (width < SSIM_WINDOW || height < SSIM_WINDOW) {
    throw new Error(`SSIM needs at least ${String(SSIM_WINDOW)} px per side`)
  }
  let total = 0
  let windows = 0
  for (let y = 0; y + SSIM_WINDOW <= height; y += SSIM_STRIDE) {
    for (let x = 0; x + SSIM_WINDOW <= width; x += SSIM_STRIDE) {
      total += windowSsim(a, b, width, x, y)
      windows++
    }
  }
  return total / windows
}

/** Block edge for the banding metric: one WebP / JPEG macroblock. */
const BAND_BLOCK = 16

/**
 * Banding proxy (8-bit levels): the worst step between neighbouring 16 px
 * blocks that `b` adds over `a`, i.e. the largest change of block-mean error
 * from one block to the next. Grain the encoder smooths away averages out
 * inside a block and a uniform offset cancels between blocks; a contour
 * where a gradient snaps to a flat level does not. Edge blocks are partial.
 */
export function maxBandStep(
  a: Float32Array,
  b: Float32Array,
  width: number,
  height: number,
): number {
  const cols = Math.ceil(width / BAND_BLOCK)
  const rows = Math.ceil(height / BAND_BLOCK)
  const error = new Float64Array(cols * rows)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const block =
        Math.floor(y / BAND_BLOCK) * cols + Math.floor(x / BAND_BLOCK)
      error[block] =
        (error[block] ?? 0) + (a[y * width + x] ?? 0) - (b[y * width + x] ?? 0)
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const w = Math.min(BAND_BLOCK, width - col * BAND_BLOCK)
      const h = Math.min(BAND_BLOCK, height - row * BAND_BLOCK)
      const i = row * cols + col
      error[i] = (error[i] ?? 0) / (w * h)
    }
  }
  let worst = 0
  for (let i = 0; i < error.length; i++) {
    const here = error[i] ?? 0
    const right = (i + 1) % cols === 0 ? here : (error[i + 1] ?? here)
    const below = error[i + cols] ?? here
    worst = Math.max(worst, Math.abs(right - here), Math.abs(below - here))
  }
  return worst
}
