import {
  resolveParentFrames,
  spreadParent,
  viewGuides,
  type Book,
  type Frame,
} from '../core'

/** Half the 9 px band own guides take a press in (Designer PO2). */
const PARENT_GUIDE_HIT_PX = 4.5

export type ParentHit =
  | { kind: 'copy'; frame: Frame }
  | { kind: 'guide'; guideId: string }
  | { kind: 'frame'; frameId: string; parentName: string }

interface PointMm {
  x: number
  y: number
}

/** Whether a spread point lies in the frame's rect turned about its centre. */
function frameContains(frame: Frame, point: PointMm): boolean {
  const { x, y, width, height } = frame.rect
  const cx = x + width / 2
  const cy = y + height / 2
  const rad = (-(frame.rotationDeg ?? 0) * Math.PI) / 180
  const dx = point.x - cx
  const dy = point.y - cy
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad)
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad)
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2
}

/**
 * The parent-layer item a press at `point` (spread mm) means, looking
 * through the spread's own frames (Designer review 3): the topmost override
 * copy containing the point, else a parent guide within 4.5 screen px
 * (nearest; only while `guidesShown`), else the topmost parent frame
 * containing the point. Hidden items and own items never hit.
 */
export function parentHitAt(
  book: Book,
  spreadId: string,
  point: PointMm,
  pxPerMm: number,
  guidesShown = true,
): ParentHit | null {
  const spreadIndex = book.spreads.findIndex((s) => s.id === spreadId)
  const spread = book.spreads[spreadIndex]
  if (spread === undefined) {
    return null
  }
  // Painted bottom to top, so the last hit of a layer is its topmost.
  const resolved = resolveParentFrames(book, spread)
  const topmost = (layer: 'override' | 'parent'): Frame | undefined =>
    resolved
      .filter(
        (item) => item.layer === layer && frameContains(item.frame, point),
      )
      .at(-1)?.frame
  const copy = topmost('override')
  if (copy !== undefined) {
    return { kind: 'copy', frame: copy }
  }
  const parent = spreadParent(book, spread)
  if (parent === undefined) {
    return null
  }
  const guide = guidesShown
    ? viewGuides(book, spreadIndex, spread)
        .filter(({ layer }) => layer === 'parent')
        .map(({ guide: g }) => ({
          id: g.id,
          px:
            Math.abs(
              (g.orientation === 'vertical' ? point.x : point.y) - g.offsetMm,
            ) * pxPerMm,
        }))
        .filter(({ px }) => px <= PARENT_GUIDE_HIT_PX)
        .sort((a, b) => a.px - b.px)[0]
    : undefined
  if (guide !== undefined) {
    return { kind: 'guide', guideId: guide.id }
  }
  const frame = topmost('parent')
  return frame === undefined
    ? null
    : { kind: 'frame', frameId: frame.id, parentName: parent.name }
}

/** Mac shows the ⌘⇧ wording; every platform accepts both combos. */
export function isMacPlatform(
  userAgent: string = globalThis.navigator.userAgent,
): boolean {
  return /Macintosh|iPhone|iPad/.test(userAgent)
}
