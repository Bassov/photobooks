import type { Book } from '../core'
import { pageGridRects } from './gridOverlayModel'

/** Pull distance in CSS px while the grid is visible. */
export const GRID_SNAP_PULL_PX = 16

interface GridAnchor {
  /** Spread-space position in mm. */
  mm: number
  /** `column 3` / `row 2` (1-based); the nearest band wins on shared edges. */
  label: string
}

export interface GridAnchors {
  x: GridAnchor[]
  y: GridAnchor[]
}

/** Built once at gesture start: every page's column and row band edges. */
export function buildGridAnchors(book: Book, spreadIndex: number): GridAnchors {
  const x: GridAnchor[] = []
  const y: GridAnchor[] = []
  for (const page of pageGridRects(book, spreadIndex)) {
    page.columns.forEach((c, i) => {
      const label = `column ${String(i + 1)}`
      x.push({ mm: c.x, label }, { mm: c.x + c.width, label })
    })
    page.rows.forEach((r, i) => {
      const label = `row ${String(i + 1)}`
      y.push({ mm: r.y, label }, { mm: r.y + r.height, label })
    })
  }
  return { x, y }
}

export interface GridSnapOptions {
  gridVisible: boolean
  snapOn: boolean
  altKey: boolean
  pxPerMm: number
}

export interface GridSnapResult {
  /** Shift to add to the dragged edges, in mm (0 on an axis without a hit). */
  dx: number
  dy: number
  /** `snap · column N` / `snap · row N`; column wins when both axes hit. */
  label: string
}

function nearest(
  anchors: readonly GridAnchor[],
  edges: readonly number[],
  reachMm: number,
): { delta: number; label: string } | null {
  let best: { delta: number; label: string } | null = null
  for (const edge of edges) {
    for (const anchor of anchors) {
      const delta = anchor.mm - edge
      if (
        Math.abs(delta) <= reachMm &&
        (best === null || Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, label: anchor.label }
      }
    }
  }
  return best
}

/**
 * Snap the dragged edges (`xEdges` / `yEdges`, mm) to the nearest anchor.
 * Returns null when snapping is inactive: grid hidden, snap off, or Alt held.
 */
export function snapEdgesToGrid(
  anchors: GridAnchors,
  xEdges: readonly number[],
  yEdges: readonly number[],
  options: GridSnapOptions,
): GridSnapResult | null {
  if (!options.gridVisible || !options.snapOn || options.altKey) {
    return null
  }
  const reachMm = GRID_SNAP_PULL_PX / options.pxPerMm
  const hitX = nearest(anchors.x, xEdges, reachMm)
  const hitY = nearest(anchors.y, yEdges, reachMm)
  const hit = hitX ?? hitY
  if (hit === null) {
    return null
  }
  return {
    dx: hitX?.delta ?? 0,
    dy: hitY?.delta ?? 0,
    label: `snap · ${hit.label}`,
  }
}
