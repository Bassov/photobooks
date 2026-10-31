import type { Book } from '../schema'
import { getSpreadSizeMm } from '../geometry/spreadSize'
import type { RectMm } from '../geometry/types'
import { isTemplateId } from './types'

/** One slot of a saved layout in percent of the spread trim (kit `Template.frames`). */
export interface LayoutSlotPct {
  x: number
  y: number
  w: number
  h: number
}

/** Saved-layout slots scaled to the trim of spread `spreadIndex`. */
export function customLayoutRects(
  book: Book,
  spreadIndex: number,
  slots: readonly LayoutSlotPct[],
): RectMm[] {
  const { widthMm, heightMm } = getSpreadSizeMm(book, spreadIndex)
  // Multiply first: whole percents of whole-mm trims stay exact.
  return slots.map((slot) => ({
    x: (slot.x * widthMm) / 100,
    y: (slot.y * heightMm) / 100,
    width: (slot.w * widthMm) / 100,
    height: (slot.h * heightMm) / 100,
  }))
}

/**
 * Kit "Save as template": the image frames of a spread, top-down in z order,
 * as percent of its trim. Empty when the spread has no image frames.
 */
export function spreadLayoutSlots(
  book: Book,
  spreadId: string,
): LayoutSlotPct[] {
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  const spread = book.spreads[index]
  if (spread === undefined) {
    return []
  }
  const { widthMm, heightMm } = getSpreadSizeMm(book, index)
  return spread.frames
    .filter((frame) => frame.kind !== 'text')
    .map((frame) => ({
      x: (frame.rect.x / widthMm) * 100,
      y: (frame.rect.y / heightMm) * 100,
      w: (frame.rect.width / widthMm) * 100,
      h: (frame.rect.height / heightMm) * 100,
    }))
}

/** Saved layouts live outside the template catalog; their ids never clash with it. */
export function isCustomLayoutId(value: string): boolean {
  return value.startsWith('user-') && !isTemplateId(value)
}
