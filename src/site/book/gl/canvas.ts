/* Canvas 2D helpers of the GL book: textures are painted on canvases first. */

export const cv = (w: number, h: number): HTMLCanvasElement =>
  Object.assign(document.createElement('canvas'), {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  })

export function ctx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d')
  if (!x) throw new Error('no 2D context')
  return x
}

/**
 * Paper grain (the kit's `grain`): luminance noise ±amp/2 per cell × cell
 * texels (the page texture is ~2 texels per screen px: a 2-texel cell keeps
 * the grain per screen pixel instead of averaging it away in the mipmaps).
 * Rows `y0` … `y1` only (a band of `rowBands`); noise rows renew every
 * `cell` rows from `y0`.
 */
export function grain(
  x: CanvasRenderingContext2D,
  w: number,
  h: number,
  amp: number,
  cell = 1,
  y0 = 0,
  y1 = h,
): void {
  const d = x.getImageData(0, y0, w, y1 - y0)
  const a = d.data
  const cw = Math.ceil(w / cell)
  const row = new Float32Array(cw)
  for (let y = 0; y < y1 - y0; y++) {
    if (y % cell === 0) {
      for (let i = 0; i < cw; i++) row[i] = (Math.random() - 0.5) * amp
    }
    for (let px = 0, i = y * w * 4; px < w; px++, i += 4) {
      const n = row[Math.floor(px / cell)] ?? 0
      a[i] = (a[i] ?? 0) + n
      a[i + 1] = (a[i + 1] ?? 0) + n
      a[i + 2] = (a[i + 2] ?? 0) + n
    }
  }
  x.putImageData(d, 0, y0)
}

/** texels per grain band: a 2× page (1200 × 1600) grains in 8 tasks */
export const GRAIN_BAND_PX = 1 << 18

/**
 * The row bands `[y0, y1)` of a `w` × `h` canvas: whole cells of `cell` rows,
 * at most `texels` each unless one cell row is wider. Per-texel work (grain,
 * the canvas raster of a band's draws) goes one band per task.
 */
export function rowBands(
  w: number,
  h: number,
  texels: number,
  cell = 1,
): [number, number][] {
  const rows = Math.max(cell, Math.floor(texels / w / cell) * cell)
  const bands: [number, number][] = []
  for (let y = 0; y < h; y += rows) bands.push([y, Math.min(h, y + rows)])
  return bands
}

/** the next task (`setTimeout` 0) */
export const nextTask = (): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
