import { getSinglePageSide, getSpreadPageCount } from '../core'
import { slotPageLeftPx } from './pasteboardView'

/** A mounted spread's page rect in world px, from the camera origin. */
export interface PageShadowRect {
  spreadId: string
  u: number
  v: number
  w: number
  h: number
}

/**
 * Page rects of the mounted slots, laid out like the world: slot `i` starts
 * `i` strides below the origin and its spread is centred in the stack width;
 * a single page sits on its half of a spread-wide slot.
 */
export function pageShadowRects(input: {
  mounted: readonly string[]
  start: number
  spreadCount: number
  stride: number
  spreadHeightPx: number
  pageWidthPx: number
  worldWidthPx: number
}): PageShadowRect[] {
  return input.mounted.map((spreadId, index) => {
    const slot = input.start + index
    const w = input.pageWidthPx * getSpreadPageCount(slot, input.spreadCount)
    return {
      spreadId,
      u: slotPageLeftPx({
        worldWidthPx: input.worldWidthPx,
        paperWidthPx: w,
        side: getSinglePageSide(slot, input.spreadCount),
      }),
      v: slot * input.stride,
      w,
      h: input.spreadHeightPx,
    }
  })
}
