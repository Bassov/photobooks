import { getSpreadPageCount } from '../geometry/spreadSize'
import type { NormalizedRect, RectMm, ResolvedItem } from '../geometry/types'
import type { PrintProfile } from '../print/profileSchema'

/** PDF points per millimetre (72 pt per inch). */
export const PT_PER_MM = 72 / 25.4

/** Crop marks start at least this far outside the trim (and never inside the bleed). */
const CROP_MARK_MIN_OFFSET_MM = 3
export const CROP_MARK_LENGTH_MM = 5
/** Hairline crop marks, in points. */
export const CROP_MARK_WIDTH_PT = 0.25

/**
 * Affine matrix `[a, b, c, d, e, f]` as in PDF `cm`:
 * `x' = a·x + c·y + e`, `y' = b·x + d·y + f`.
 */
export type Matrix = readonly [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `m ∘ n`: apply `n` first, then `m`. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const [na, nb, nc, nd, ne, nf] = n
  return [
    a * na + c * nb,
    b * na + d * nb,
    a * nc + c * nd,
    b * nc + d * nd,
    a * ne + c * nf + e,
    b * ne + d * nf + f,
  ]
}

/** `multiply` over a chain, leftmost applied last. */
export function compose(...chain: Matrix[]): Matrix {
  return chain.reduce(multiply, IDENTITY)
}

export function translate(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y]
}

export function scale(x: number, y: number): Matrix {
  return [x, 0, 0, y, 0, 0]
}

/** Clockwise on a y-down page, like CSS `rotate()`. */
export function rotate(deg: number): Matrix {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [cos, sin, -sin, cos, 0, 0]
}

export function applyMatrix(
  m: Matrix,
  point: { x: number; y: number },
): { x: number; y: number } {
  const [a, b, c, d, e, f] = m
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
}

/** One PDF page: the part of spread `spreadIndex` inside `trim` (spread mm). */
export interface PdfSheet {
  spreadIndex: number
  trim: RectMm
}

/**
 * PDF pages of a book with `spreadCount` spreads: one per book page
 * (`'pages'`, a two-page spread splits at the trim width) or one per spread.
 */
export function pdfSheets(
  spreadCount: number,
  trim: { widthMm: number; heightMm: number },
  output: PrintProfile['output'],
): PdfSheet[] {
  const { widthMm, heightMm } = trim
  const sheets: PdfSheet[] = []
  for (let spreadIndex = 0; spreadIndex < spreadCount; spreadIndex += 1) {
    const pages = getSpreadPageCount(spreadIndex, spreadCount)
    if (output === 'spreads') {
      sheets.push({
        spreadIndex,
        trim: { x: 0, y: 0, width: pages * widthMm, height: heightMm },
      })
      continue
    }
    for (let page = 0; page < pages; page += 1) {
      sheets.push({
        spreadIndex,
        trim: { x: page * widthMm, y: 0, width: widthMm, height: heightMm },
      })
    }
  }
  return sheets
}

/** The book's bleed inside the profile's range (mm). */
export function printBleedMm(
  bookBleedMm: number,
  profile: Pick<PrintProfile, 'bleedMinMm' | 'bleedMaxMm'>,
): number {
  return Math.min(profile.bleedMaxMm, Math.max(profile.bleedMinMm, bookBleedMm))
}

/** PDF rect in points, origin bottom-left. */
interface PdfBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SheetBoxes {
  media: PdfBox
  bleed: PdfBox
  trim: PdfBox
  /** Media margin around the trim (mm): the bleed, or the crop-mark area. */
  slugMm: number
}

/** Mark start distance from the trim (mm); marks never reach into the bleed. */
export function cropMarkOffsetMm(bleedMm: number): number {
  return Math.max(bleedMm, CROP_MARK_MIN_OFFSET_MM)
}

/** Trim, bleed and media boxes of a `widthMm` × `heightMm` page. */
export function sheetBoxes(
  widthMm: number,
  heightMm: number,
  bleedMm: number,
  cropMarks: boolean,
): SheetBoxes {
  const slugMm = cropMarks
    ? cropMarkOffsetMm(bleedMm) + CROP_MARK_LENGTH_MM
    : bleedMm
  const box = (inset: number): PdfBox => ({
    x: inset * PT_PER_MM,
    y: inset * PT_PER_MM,
    width: (widthMm + 2 * (slugMm - inset)) * PT_PER_MM,
    height: (heightMm + 2 * (slugMm - inset)) * PT_PER_MM,
  })
  return {
    media: box(0),
    bleed: box(slugMm - bleedMm),
    trim: box(slugMm),
    slugMm,
  }
}

/**
 * Spread mm (y down) → PDF points (y up) on `sheet`'s page whose media
 * margin is `slugMm`.
 */
export function sheetMatrix(sheet: PdfSheet, slugMm: number): Matrix {
  const mediaHeightMm = sheet.trim.height + 2 * slugMm
  return compose(
    scale(PT_PER_MM, PT_PER_MM),
    translate(0, mediaHeightMm),
    scale(1, -1),
    translate(slugMm - sheet.trim.x, slugMm - sheet.trim.y),
  )
}

export interface Segment {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/** Eight crop marks (spread mm) on the extended trim lines, outside the bleed. */
export function cropMarkSegments(trim: RectMm, bleedMm: number): Segment[] {
  const start = cropMarkOffsetMm(bleedMm)
  const end = start + CROP_MARK_LENGTH_MM
  const corners = [
    { x: trim.x, y: trim.y, dx: -1, dy: -1 },
    { x: trim.x + trim.width, y: trim.y, dx: 1, dy: -1 },
    { x: trim.x, y: trim.y + trim.height, dx: -1, dy: 1 },
    { x: trim.x + trim.width, y: trim.y + trim.height, dx: 1, dy: 1 },
  ]
  return corners.flatMap(({ x, y, dx, dy }) => [
    { from: { x: x + dx * start, y }, to: { x: x + dx * end, y } },
    { from: { x, y: y + dy * start }, to: { x, y: y + dy * end } },
  ])
}

/** Frame-local mm (origin at the frame's top-left) → spread mm, rotated about its centre. */
export function frameMatrix(
  item: Pick<ResolvedItem, 'rectMm' | 'rotation'>,
): Matrix {
  const { x, y, width, height } = item.rectMm
  return compose(
    translate(x + width / 2, y + height / 2),
    rotate(item.rotation),
    translate(-width / 2, -height / 2),
  )
}

/** Whether the (rotated) frame reaches into `area` (spread mm). */
export function frameTouches(
  item: Pick<ResolvedItem, 'rectMm' | 'rotation'>,
  area: RectMm,
): boolean {
  const { width, height } = item.rectMm
  const m = frameMatrix(item)
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ].map((point) => applyMatrix(m, point))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return (
    Math.min(...xs) < area.x + area.width &&
    Math.max(...xs) > area.x &&
    Math.min(...ys) < area.y + area.height &&
    Math.max(...ys) > area.y
  )
}

/**
 * EXIF orientation 1–8: the raw image's unit square (y down) → the displayed
 * one, where the crop window lives.
 */
export function orientationMatrix(orientation: number | undefined): Matrix {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, 1, 0]
    case 3:
      return [-1, 0, 0, -1, 1, 1]
    case 4:
      return [1, 0, 0, -1, 0, 1]
    case 5:
      return [0, 1, 1, 0, 0, 0]
    case 6:
      return [0, 1, -1, 0, 1, 0]
    case 7:
      return [0, -1, -1, 0, 1, 1]
    case 8:
      return [0, -1, 1, 0, 0, 1]
    default:
      return IDENTITY
  }
}

/** EXIF orientations 5–8 swap the raw width and height. */
export function orientedAspect(
  widthPx: number,
  heightPx: number,
  orientation: number | undefined,
): number {
  return (orientation ?? 1) >= 5 ? heightPx / widthPx : widthPx / heightPx
}

const FULL_WINDOW: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 }

/** PDF image space (unit square, y up) → raw image unit square (y down). */
const IMAGE_Y_DOWN: Matrix = [1, 0, 0, -1, 0, 1]

/**
 * PDF image space → frame-local mm: the photo laid out as `turnedPhotoStyle`
 * does (crop window centred, quarter turns + straighten about the frame
 * centre, flips innermost), with the raw image's EXIF orientation applied.
 */
export function imageMatrix(
  item: Pick<
    ResolvedItem,
    | 'rectMm'
    | 'sourceCropRect'
    | 'photoQuarterTurns'
    | 'straightenDeg'
    | 'photoFlipH'
    | 'photoFlipV'
  >,
  orientation?: number,
): Matrix {
  const { width: frameW, height: frameH } = item.rectMm
  const window = item.sourceCropRect ?? FULL_WINDOW
  const quarterTurns = item.photoQuarterTurns ?? 0
  const odd = quarterTurns % 2 === 1
  const width = (odd ? frameH : frameW) / window.width
  const height = (odd ? frameW : frameH) / window.height
  const shiftX = (0.5 - (window.x + window.width / 2)) * width
  const shiftY = (0.5 - (window.y + window.height / 2)) * height
  return compose(
    translate(frameW / 2, frameH / 2),
    rotate(quarterTurns * 90 + (item.straightenDeg ?? 0)),
    translate(shiftX, shiftY),
    scale(item.photoFlipH === true ? -1 : 1, item.photoFlipV === true ? -1 : 1),
    translate(-width / 2, -height / 2),
    scale(width, height),
    orientationMatrix(orientation),
    IMAGE_Y_DOWN,
  )
}
