import { frameDpi, lowDpi, sourceCropRect } from '../core'

/**
 * Filmstrip "Low-res" rule (Designer r15 M85): the canvas low-res badge
 * threshold, checked for the photo filling one page of the book (fill crop,
 * no zoom). Reads pixel dimensions only, so it never decodes.
 */
export function pageFillLowRes(
  trim: { widthMm: number; heightMm: number },
  size: { widthPx: number; heightPx: number },
): boolean {
  const pageMm = { x: 0, y: 0, width: trim.widthMm, height: trim.heightMm }
  const crop = sourceCropRect(pageMm, undefined, size.widthPx / size.heightPx)
  return (
    lowDpi(frameDpi(pageMm, crop, 0, size.widthPx, size.heightPx)) !== undefined
  )
}
