import { getSpreadPageCount } from '../core'

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
 * `i` strides below the origin and its spread is centred in the stack width.
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
      u: (input.worldWidthPx - w) / 2,
      v: slot * input.stride,
      w,
      h: input.spreadHeightPx,
    }
  })
}
