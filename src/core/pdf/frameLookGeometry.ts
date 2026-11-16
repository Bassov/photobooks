import type { RectMm, ResolvedFrameStyle } from '../geometry/types'
import { compose, scale, translate, type Matrix } from './pdfGeometry'

/** Canvas defaults when a style leaves a colour unset (`frameStyleCss`). */
const MAT_COLOR = '#ffffff'
const STROKE_COLOR = '#1c1b1a'

/** Cubic Bézier handle length of a quarter circle, per unit radius. */
const KAPPA = 0.5522847498

export interface RoundedRect {
  rect: RectMm
  radiusMm: number
}

/**
 * A photo frame's look in frame-local mm (origin top-left, y down), as the
 * kit canvas paints it: the mat fills the frame box, the photo sits inset by
 * the mat, the stroke lies on top inside the frame edge, and the corner radius
 * clips mat and photo.
 */
export interface FrameLook {
  /** The frame box: clips everything below. */
  outer: RoundedRect
  /** Mat colour; absent without a mat. */
  matColor?: string
  photo: RoundedRect
  /** Centre line of the stroke; absent without a stroke. */
  stroke?: RoundedRect & { widthMm: number; color: string }
}

function inset(rect: RectMm, by: number): RectMm {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  }
}

/**
 * Look of a `width` × `height` frame; undefined when the style draws nothing
 * (the frame paints as a plain clipped photo). Mat, stroke and radius are
 * clamped to half of the shorter side, so no rect turns negative.
 */
export function frameLook(
  size: { width: number; height: number },
  style: ResolvedFrameStyle | undefined,
): FrameLook | undefined {
  if (style === undefined) return undefined
  const half = Math.min(size.width, size.height) / 2
  const mat = Math.min(style.matMm, half)
  const stroke = Math.min(style.strokeMm, half)
  const radius = Math.min(style.cornerRadiusMm, half)
  if (mat <= 0 && stroke <= 0 && radius <= 0) return undefined
  const outer = { x: 0, y: 0, width: size.width, height: size.height }
  return {
    outer: { rect: outer, radiusMm: radius },
    ...(mat > 0 ? { matColor: style.matColor ?? MAT_COLOR } : {}),
    photo: { rect: inset(outer, mat), radiusMm: Math.max(0, radius - mat) },
    ...(stroke > 0
      ? {
          stroke: {
            rect: inset(outer, stroke / 2),
            radiusMm: Math.max(0, radius - stroke / 2),
            widthMm: stroke,
            color: style.strokeColor ?? STROKE_COLOR,
          },
        }
      : {}),
  }
}

/**
 * Frame-local mm → frame-local mm: shrinks the photo laid out on the whole
 * frame about the frame centre, just enough to still cover `photo` (the crop
 * keeps its aspect, like the kit's cover fit in the inset box).
 */
export function insetPhotoMatrix(
  size: { width: number; height: number },
  photo: RectMm,
): Matrix {
  const k = Math.max(photo.width / size.width, photo.height / size.height)
  const cx = size.width / 2
  const cy = size.height / 2
  return compose(translate(cx, cy), scale(k, k), translate(-cx, -cy))
}

interface Point {
  x: number
  y: number
}

export type PathSegment =
  | { op: 'move'; to: Point }
  | { op: 'line'; to: Point }
  | { op: 'curve'; c1: Point; c2: Point; to: Point }
  | { op: 'close' }

/** `from` moved `distance` along the axis towards `towards`. */
function toward(from: Point, towards: Point, distance: number): Point {
  return {
    x: from.x + Math.sign(towards.x - from.x) * distance,
    y: from.y + Math.sign(towards.y - from.y) * distance,
  }
}

function lerp(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/** Closed outline of a rounded rect, clockwise from the top-left corner's end. */
export function roundedRectPath({
  rect,
  radiusMm,
}: RoundedRect): PathSegment[] {
  const { x, y, width, height } = rect
  const topLeft = { x, y }
  const topRight = { x: x + width, y }
  const bottomRight = { x: x + width, y: y + height }
  const bottomLeft = { x, y: y + height }
  // Each corner with its neighbours: [previous, corner, next].
  const turns: [Point, Point, Point][] = [
    [topLeft, topRight, bottomRight],
    [topRight, bottomRight, bottomLeft],
    [bottomRight, bottomLeft, topLeft],
    [bottomLeft, topLeft, topRight],
  ]
  const segments: PathSegment[] = [
    { op: 'move', to: toward(topLeft, topRight, radiusMm) },
  ]
  for (const [previous, corner, next] of turns) {
    const entry = toward(corner, previous, radiusMm)
    const exit = toward(corner, next, radiusMm)
    segments.push({ op: 'line', to: entry })
    if (radiusMm > 0) {
      segments.push({
        op: 'curve',
        c1: lerp(entry, corner, KAPPA),
        c2: lerp(exit, corner, KAPPA),
        to: exit,
      })
    }
  }
  segments.push({ op: 'close' })
  return segments
}
