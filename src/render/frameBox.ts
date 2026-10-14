import type { NormalizedRect, PageCut, RectMm } from '../core'

/** Screen scale until the camera owns zoom. */
export const SPREAD_PX_PER_MM = 0.5

export interface PxBox {
  left: number
  top: number
  width: number
  height: number
}

export interface CutLine {
  orientation: PageCut['orientation']
  offsetPx: number
}

export interface ImageCropBox {
  left: string
  top: string
  width: string
  height: string
}

export function frameBox(rect: RectMm, pxPerMm = SPREAD_PX_PER_MM): PxBox {
  return {
    left: rect.x * pxPerMm,
    top: rect.y * pxPerMm,
    width: rect.width * pxPerMm,
    height: rect.height * pxPerMm,
  }
}

export function pageCutLine(cut: PageCut, pxPerMm = SPREAD_PX_PER_MM): CutLine {
  return {
    orientation: cut.orientation,
    offsetPx: cut.offsetMm * pxPerMm,
  }
}

export function imageCropBox(crop: NormalizedRect): ImageCropBox {
  const width = crop.width > 0 ? crop.width : 1
  const height = crop.height > 0 ? crop.height : 1
  return {
    width: percent(100 / width),
    height: percent(100 / height),
    left: percent((-100 * crop.x) / width),
    top: percent((-100 * crop.y) / height),
  }
}

function percent(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return `${String(rounded)}%`
}
