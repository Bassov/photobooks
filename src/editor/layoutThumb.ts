import type { RectMm } from '../core'

/** A box in percent of its parent (CSS left / top / width / height). */
export interface PercentBox {
  left: number
  top: number
  width: number
  height: number
}

/** Thumb box aspect bounds: a tall page stops at 2:3, a wide spread at 2:1. */
const MIN_THUMB_ASPECT = 2 / 3
const MAX_THUMB_ASPECT = 2
/** Trims narrower than this are single pages laid out in 3 columns. */
const THREE_COLUMN_MAX_ASPECT = 1.2

/**
 * Owner 2026-11-02 (deviates from the kit's fixed 2:1 TemplateThumb): the
 * thumb box takes the trim aspect, clamped, so the paper fills it.
 */
export function thumbAspect(widthMm: number, heightMm: number): number {
  return Math.min(
    MAX_THUMB_ASPECT,
    Math.max(MIN_THUMB_ASPECT, widthMm / heightMm),
  )
}

/** Layout grid columns: 3 for single pages narrower than 1.2:1, else 2. */
export function thumbColumns(widthMm: number, heightMm: number): 2 | 3 {
  return widthMm / heightMm < THREE_COLUMN_MAX_ASPECT ? 3 : 2
}

/** The paper inside the thumb box: the trim aspect, centered (contain). */
export function thumbPaperBox(widthMm: number, heightMm: number): PercentBox {
  const r = widthMm / heightMm / thumbAspect(widthMm, heightMm)
  const width = 100 * Math.min(1, r)
  const height = 100 * Math.min(1, 1 / r)
  return {
    left: (100 - width) / 2,
    top: (100 - height) / 2,
    width,
    height,
  }
}

/**
 * Template slots in percent of the paper, clipped to the trim: bleed frames
 * (Full bleed) end at the paper edge instead of drawing past it.
 */
export function thumbSlots(
  widthMm: number,
  heightMm: number,
  rects: readonly RectMm[],
): PercentBox[] {
  const slots: PercentBox[] = []
  for (const rect of rects) {
    const x0 = Math.max(0, rect.x)
    const y0 = Math.max(0, rect.y)
    const x1 = Math.min(widthMm, rect.x + rect.width)
    const y1 = Math.min(heightMm, rect.y + rect.height)
    if (x1 > x0 && y1 > y0) {
      slots.push({
        left: (x0 / widthMm) * 100,
        top: (y0 / heightMm) * 100,
        width: ((x1 - x0) / widthMm) * 100,
        height: ((y1 - y0) / heightMm) * 100,
      })
    }
  }
  return slots
}

export function percentStyle(box: PercentBox) {
  return {
    left: `${String(box.left)}%`,
    top: `${String(box.top)}%`,
    width: `${String(box.width)}%`,
    height: `${String(box.height)}%`,
  }
}
