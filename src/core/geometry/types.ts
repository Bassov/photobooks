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

/** Frame style with every field defaulted (0 mm / no color → not drawn). */
export interface ResolvedFrameStyle {
  strokeMm: number
  strokeColor?: string
  matMm: number
  matColor?: string
  cornerRadiusMm: number
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
  /** Photo mirrored left-right / top-bottom; omitted when false. */
  photoFlipH?: true
  photoFlipV?: true
  /** Omitted when the frame has no (or a dangling) `frameStyleId`. */
  style?: ResolvedFrameStyle
  /** Printed under the frame; omitted when empty. */
  caption?: string
  /** Tone adjustments; omitted when untouched. */
  adjust?: { brightness: number; contrast: number; saturation: number }
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
  /** sRGB `#rrggbb`; omitted → paper default. */
  backgroundColor?: string
}

export type AspectRatioLookup = (assetId: string) => number
