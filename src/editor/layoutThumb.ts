import type { RectMm } from '../core'

/** A box in percent of its parent (CSS left / top / width / height). */
export interface PercentBox {
  left: number
  top: number
  width: number
  height: number
}

/** Kit TemplateThumb is a 2:1 box (uikit/src/sandbox/chrome.tsx:244). */
const THUMB_RATIO = 2

/** The paper inside the 2:1 thumb: the spread aspect, centered (contain). */
export function thumbPaperBox(widthMm: number, heightMm: number): PercentBox {
  const r = widthMm / heightMm / THUMB_RATIO
  const width = r >= 1 ? 100 : 100 * r
  const height = r >= 1 ? 100 / r : 100
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
