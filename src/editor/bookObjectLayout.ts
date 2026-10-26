export type BookObjectFmt = 'portrait' | 'landscape' | 'square'

const RATIO: Record<BookObjectFmt, number> = {
  portrait: 4 / 5,
  landscape: 5 / 4,
  square: 1,
}

/** Map page trim mm to kit book-object format. */
export function bookFormatFromTrim(
  widthMm: number,
  heightMm: number,
): BookObjectFmt {
  const cmp = Math.sign(widthMm - heightMm)
  if (cmp === 0) {
    return 'square'
  }
  if (cmp > 0) {
    return 'landscape'
  }
  return 'portrait'
}

export function bookObjectWidthForHeight(
  h: number,
  fmt: BookObjectFmt,
): number {
  return h * RATIO[fmt]
}

/** Soft shadow ellipse under a library book cover. */
export function bookFloorBackground(): string {
  return 'radial-gradient(closest-side, rgb(35 34 35/.22), transparent)'
}

export function bookCoverStageHeight(baseH: number): number {
  return baseH + 12
}

export function bookObjectDisplayHeight(
  baseH: number,
  fmt: BookObjectFmt,
): number {
  if (fmt === 'square') {
    return baseH * 0.86
  }
  if (fmt === 'landscape') {
    return baseH * 0.74
  }
  return baseH
}

/** Pure geometry for kit BookObject chrome (mm-free CSS px at height `h`). */
export function bookObjectLayout(h: number, fmt: BookObjectFmt) {
  const w = h * RATIO[fmt]
  const s = h / 540
  const pageRight = -Math.max(4, 7 * s)
  return {
    width: w,
    height: h,
    scale: s,
    pageBlock: {
      top: 6 * s + 2,
      bottom: 6 * s + 2,
      left: 10 * s,
      right: pageRight,
      background:
        'repeating-linear-gradient(90deg,#F4F4F4 0 1px,#DBDBDB 1px 2px)',
      boxShadow: `0 ${String(40 * s)}px ${String(60 * s)}px -${String(36 * s)}px rgb(35 34 35/.55)`,
    },
    coverShadow: `0 1px 2px rgb(35 34 35/.25), 0 ${String(30 * s)}px ${String(60 * s)}px -${String(30 * s)}px rgb(35 34 35/.6)`,
    spineWidth: Math.max(8, 18 * s),
    titleSize: Math.round(Math.min(w, h) * 0.14),
    subSize: Math.max(8, Math.round(h * 0.022)),
  }
}
