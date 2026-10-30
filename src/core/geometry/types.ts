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
  /** Frame rotation in degrees about the rect center. */
  rotation: number
  /** Locked frame: no move / resize / rotate; omitted when unlocked. */
  locked?: true
  /** Photo quarter turns (clockwise) inside the frame; omitted when 0. */
  photoQuarterTurns?: 1 | 2 | 3
  /** Photo fine rotation in degrees; omitted when 0. */
  straightenDeg?: number
  assetId?: string
  sourceCropRect?: NormalizedRect
  /** Editor-only: set when the photo prints below the warn DPI. */
  lowDpi?: { dpi: number; level: 'warn' | 'min' }
}

export interface ResolvedSpread {
  items: ResolvedItem[]
  pageCuts: PageCut[]
  spreadWidthMm: number
  spreadHeightMm: number
}

export type AspectRatioLookup = (assetId: string) => number
