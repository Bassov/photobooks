export interface RectMm {
  x: number
  y: number
  width: number
  height: number
}

/** Normalized source-space rectangle (0–1). */
export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PageCut {
  orientation: 'vertical' | 'horizontal'
  offsetMm: number
}

export interface ResolvedItem {
  frameId: string
  rectMm: RectMm
  z: number
  rotation: 0
  assetId?: string
  sourceCropRect?: NormalizedRect
}

export interface ResolvedSpread {
  items: ResolvedItem[]
  pageCuts: PageCut[]
  spreadWidthMm: number
  spreadHeightMm: number
}

export type AspectRatioLookup = (assetId: string) => number
