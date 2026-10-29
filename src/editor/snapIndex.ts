import type { RectMm } from '../core'

/** Pull distance in CSS px for frame / guide / gap snapping. */
export const FRAME_SNAP_PULL_PX = 8

type SnapKind =
  | 'frame'
  | 'frame center'
  | 'trim'
  | 'spine'
  | 'page center'
  | 'center'
  | 'guide'
  | 'equal gap'

/** Spread paper the page anchors derive from. */
export interface SnapPage {
  widthMm: number
  heightMm: number
  /** 2 = facing pages around a spine; 1 = a lone page. */
  pageCount: number
}

function pageAnchors(page: SnapPage): { x: SnapAnchor[]; y: SnapAnchor[] } {
  const { widthMm: w, heightMm: h } = page
  const x: SnapAnchor[] = [
    { mm: 0, kind: 'trim' },
    { mm: w, kind: 'trim' },
  ]
  if (page.pageCount === 2) {
    x.push(
      { mm: w / 2, kind: 'spine' },
      { mm: w / 4, kind: 'page center' },
      { mm: (w * 3) / 4, kind: 'page center' },
    )
  } else {
    x.push({ mm: w / 2, kind: 'center' })
  }
  return {
    x,
    y: [
      { mm: 0, kind: 'trim' },
      { mm: h, kind: 'trim' },
      { mm: h / 2, kind: 'center' },
    ],
  }
}

/** Which dragged edge an anchor may catch; unset = any. */
type Edge = 'start' | 'center' | 'end'

interface SnapAnchor {
  mm: number
  kind: SnapKind
  edge?: Edge
}

/** Anchors per axis, sorted by position so a query is a binary search. */
export interface SnapIndex {
  x: readonly SnapAnchor[]
  y: readonly SnapAnchor[]
}

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical'
  offsetMm: number
}

export interface SnapLine {
  axis: 'x' | 'y'
  mm: number
  kind: SnapKind
}

export interface SnapResult {
  dx: number
  dy: number
  lines: SnapLine[]
}

const NO_SNAP: SnapResult = { dx: 0, dy: 0, lines: [] }

function sorted(anchors: SnapAnchor[]): SnapAnchor[] {
  return anchors.sort((a, b) => a.mm - b.mm)
}

/** Gaps between neighbours that overlap on the cross axis, as `[end, start]` pairs. */
function gapAnchors(
  frames: readonly RectMm[],
  horizontal: boolean,
): SnapAnchor[] {
  const lo = (r: RectMm) => (horizontal ? r.x : r.y)
  const size = (r: RectMm) => (horizontal ? r.width : r.height)
  const crossLo = (r: RectMm) => (horizontal ? r.y : r.x)
  const crossSize = (r: RectMm) => (horizontal ? r.height : r.width)
  const gaps = new Set<number>()
  for (const a of frames) {
    for (const b of frames) {
      const gap = lo(b) - (lo(a) + size(a))
      const overlap =
        crossLo(a) < crossLo(b) + crossSize(b) &&
        crossLo(b) < crossLo(a) + crossSize(a)
      if (gap > 0 && overlap) {
        gaps.add(Math.round(gap * 10) / 10)
      }
    }
  }
  const anchors: SnapAnchor[] = []
  for (const frame of frames) {
    for (const gap of gaps) {
      anchors.push(
        { mm: lo(frame) + size(frame) + gap, kind: 'equal gap', edge: 'start' },
        { mm: lo(frame) - gap, kind: 'equal gap', edge: 'end' },
      )
    }
  }
  return anchors
}

/**
 * Built once at gesture start from the other frames and the spread / book
 * guides; per-pointermove queries never touch the document.
 */
export function buildSnapIndex(
  frames: readonly RectMm[],
  guides: readonly SnapGuide[],
  page?: SnapPage,
): SnapIndex {
  const paper = page === undefined ? undefined : pageAnchors(page)
  const x: SnapAnchor[] = paper?.x ?? []
  const y: SnapAnchor[] = paper?.y ?? []
  for (const f of frames) {
    x.push(
      { mm: f.x, kind: 'frame' },
      { mm: f.x + f.width, kind: 'frame' },
      { mm: f.x + f.width / 2, kind: 'frame center' },
    )
    y.push(
      { mm: f.y, kind: 'frame' },
      { mm: f.y + f.height, kind: 'frame' },
      { mm: f.y + f.height / 2, kind: 'frame center' },
    )
  }
  for (const g of guides) {
    ;(g.orientation === 'vertical' ? x : y).push({
      mm: g.offsetMm,
      kind: 'guide',
    })
  }
  x.push(...gapAnchors(frames, true))
  y.push(...gapAnchors(frames, false))
  return { x: sorted(x), y: sorted(y) }
}

function lowerBound(anchors: readonly SnapAnchor[], mm: number): number {
  let lo = 0
  let hi = anchors.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((anchors[mid]?.mm ?? Infinity) < mm) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

interface Probe {
  mm: number
  edge: Edge
}

function nearest(
  anchors: readonly SnapAnchor[],
  probes: readonly Probe[],
  reachMm: number,
): { delta: number; anchor: SnapAnchor } | null {
  let best: { delta: number; anchor: SnapAnchor } | null = null
  for (const probe of probes) {
    for (
      let i = lowerBound(anchors, probe.mm - reachMm);
      i < anchors.length;
      i += 1
    ) {
      const anchor = anchors[i]
      if (anchor === undefined || anchor.mm > probe.mm + reachMm) {
        break
      }
      if (anchor.edge !== undefined && anchor.edge !== probe.edge) {
        continue
      }
      const delta = anchor.mm - probe.mm
      if (best === null || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, anchor }
      }
    }
  }
  return best
}

export interface SnapOptions {
  /** Client px per mm at the current camera zoom. */
  pxPerMm: number
  altKey: boolean
}

function spanProbes(lo: number, size: number): Probe[] {
  return [
    { mm: lo, edge: 'start' },
    { mm: lo + size / 2, edge: 'center' },
    { mm: lo + size, edge: 'end' },
  ]
}

/**
 * Shift that lands an edge / center of `rect` on the nearest anchor per axis.
 * Alt (or an empty index) suppresses snapping.
 */
export function snapRect(
  index: SnapIndex,
  rect: RectMm,
  options: SnapOptions,
): SnapResult {
  return snapProbes(
    index,
    spanProbes(rect.x, rect.width),
    spanProbes(rect.y, rect.height),
    options,
  )
}

/** Edges a resize handle drags; only these probe the index. */
export interface MovingEdges {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

/**
 * Shift (dx / dy) that lands each moving edge of `rect` on the nearest anchor;
 * the caller applies it to those edges only.
 */
export function snapEdges(
  index: SnapIndex,
  rect: RectMm,
  moving: MovingEdges,
  options: SnapOptions,
): SnapResult {
  const xProbes: Probe[] = []
  const yProbes: Probe[] = []
  if (moving.left) {
    xProbes.push({ mm: rect.x, edge: 'start' })
  }
  if (moving.right) {
    xProbes.push({ mm: rect.x + rect.width, edge: 'end' })
  }
  if (moving.top) {
    yProbes.push({ mm: rect.y, edge: 'start' })
  }
  if (moving.bottom) {
    yProbes.push({ mm: rect.y + rect.height, edge: 'end' })
  }
  return snapProbes(index, xProbes, yProbes, options)
}

/** Shift that lands a single dragged point (the draw corner) on an anchor. */
export function snapPoint(
  index: SnapIndex,
  point: { x: number; y: number },
  options: SnapOptions,
): SnapResult {
  return snapProbes(
    index,
    [
      { mm: point.x, edge: 'start' },
      { mm: point.x, edge: 'end' },
    ],
    [
      { mm: point.y, edge: 'start' },
      { mm: point.y, edge: 'end' },
    ],
    options,
  )
}

function snapProbes(
  index: SnapIndex,
  xProbes: readonly Probe[],
  yProbes: readonly Probe[],
  options: SnapOptions,
): SnapResult {
  if (options.altKey) {
    return NO_SNAP
  }
  const reachMm = FRAME_SNAP_PULL_PX / options.pxPerMm
  const hitX = nearest(index.x, xProbes, reachMm)
  const hitY = nearest(index.y, yProbes, reachMm)
  const lines: SnapLine[] = []
  if (hitX !== null) {
    lines.push({ axis: 'x', mm: hitX.anchor.mm, kind: hitX.anchor.kind })
  }
  if (hitY !== null) {
    lines.push({ axis: 'y', mm: hitY.anchor.mm, kind: hitY.anchor.kind })
  }
  return { dx: hitX?.delta ?? 0, dy: hitY?.delta ?? 0, lines }
}
