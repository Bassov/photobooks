/** Pure tick math for the mm rulers (kit `Ruler`); px are CSS px along the ruler. */

export const RULER_PX = 22

export type RulerAxis = 'x' | 'y'

export interface RulerTick {
  readonly mm: number
  /** Position along the ruler in px. */
  readonly p: number
  readonly major: boolean
  /** Only on majors. */
  readonly label?: number
}

/** Smallest major spacing in px; below the kit's 20 mm step the ladder keeps labels apart. */
const MIN_MAJOR_PX = 24
const COARSE_STEPS_MM = [20, 50, 100, 200, 500, 1000]

/** Major step in mm for a screen scale `sc` (px per mm): kit 5 / 10 / 20, then coarser when zoomed far out. */
export function rulerStepMm(sc: number): number {
  if (sc > 2.4) return 5
  if (sc > 1.2) return 10
  return COARSE_STEPS_MM.find((step) => step * sc >= MIN_MAJOR_PX) ?? 1000
}

/** X labels are page-local (reset at the spine, which reads 0). */
export function pageLocalMm(mm: number, pageMm: number): number {
  return ((mm % pageMm) + pageMm) % pageMm
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Ticks every step/5 mm that fall inside `[0, len]`.
 * `origin` is the px position of mm 0, `len` the ruler length in px.
 */
export function rulerTicks(input: {
  axis: RulerAxis
  origin: number
  sc: number
  len: number
  pageMm: number
}): RulerTick[] {
  const { axis, origin, sc, len, pageMm } = input
  if (sc <= 0 || len <= 0) return []
  const step = rulerStepMm(sc)
  const minor = step / 5
  const first = Math.ceil(-origin / sc / minor)
  const last = Math.floor((len - origin) / sc / minor)
  const ticks: RulerTick[] = []
  for (let i = first; i <= last; i += 1) {
    const mm = i * minor || 0
    const p = origin + mm * sc
    if (i % 5 !== 0) {
      ticks.push({ mm, p, major: false })
      continue
    }
    const label = axis === 'x' ? pageLocalMm(mm, pageMm) : mm
    ticks.push({ mm, p, major: true, label: roundMm(label) })
  }
  return ticks
}

/** Spread box → ruler origins (px of mm 0 on each axis), scale (px/mm) and the spine position. */
export function rulerGeometry(input: {
  boxLeft: number
  boxTop: number
  boxWidth: number
  areaLeft: number
  areaTop: number
  /** Layout width of the spread element (ignores zoom transforms). */
  offsetWidth: number
  /** Layout px per mm at the committed zoom. */
  pxPerMm: number
  pageMm: number
}): { originX: number; originY: number; sc: number; spineMm: number | null } {
  const { offsetWidth, pxPerMm, pageMm } = input
  const spreadMm = offsetWidth / pxPerMm
  return {
    originX: input.boxLeft - input.areaLeft,
    originY: input.boxTop - input.areaTop,
    sc: (input.boxWidth / offsetWidth) * pxPerMm,
    spineMm: spreadMm > pageMm * 1.5 ? pageMm : null,
  }
}
