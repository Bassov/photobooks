/*
 * The BookReader's pure parts (reader.tsx): the book's geometry and the
 * styles of its boards, edges, pages and leaves, and the decisions its keys,
 * pointer and `view` changes make. Views: 0 the closed front cover, v the
 * spread v − 1, n − 1 the closed back cover.
 */
import type { CSSProperties } from 'react'

export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x))
export const px = (n: number) => `${String(n)}px`
const sin = (deg: number) => Math.sin((deg * Math.PI) / 180)

/** one interior leaf, ms */
const TURN_MS = 820
/** a board (the covers), ms */
const BOARD_MS = 1000
/** the outer band of a page where the corner lifts under a fine pointer, px */
const CORNER = 64

/** The book facts the geometry reads. */
export interface GeoBook {
  trimMm: { w: number }
  pageCount: number
  spine: { cloth: string }
}
/** Board (cloth) BD, page-block side edge eMax and tail strip tE, px */
export interface Geo {
  W: number
  H: number
  pw: number
  n: number
  board: string
  BD: number
  eMax: number
  tE: number
}
export function geoOf(b: GeoBook, W: number, H: number, n: number): Geo {
  const sr = W / (2 * (b.trimMm.w / 10))
  const BD = clamp(0.3 * sr, 3, 8)
  // the closed book's thickness at sr px/cm (Book3D)
  const thick = Math.max(12, (0.6 + (b.pageCount / 2) * 0.1) * sr)
  const eMax = clamp(0.45 * (thick - 0.5 * sr), 3, 14)
  return {
    W,
    H,
    pw: W / 2,
    n,
    board: b.spine.cloth,
    BD,
    eMax,
    // eMax ≤ 14: the strip stays under 5 px
    tE: Math.max(2, 0.35 * eMax),
  }
}
/** how far view v is read, 0 (first spread) … 1 (last spread) */
export const readOf = (g: Geo, v: number) =>
  clamp((v - 1) / Math.max(1, g.n - 3), 0, 1)
/** the page-block side edges [left, right] at read fraction r: the read pages pile up on the left */
export const edgesOf = (g: Geo, r: number): [number, number] => [
  1 + (g.eMax - 1) * r,
  1 + (g.eMax - 1) * (1 - r),
]

/** A board: reaches tE below the page block, its bottom BD + 1 px darker. */
function boardStyle(
  g: Geo,
  left: boolean,
  x: number,
  w: number,
): CSSProperties {
  const { H, BD, tE, board } = g
  const dark = px(BD + 1)
  const bottom = `linear-gradient(0deg, color-mix(in srgb, ${board} 85%, #000) 0 ${dark}, transparent ${dark})`
  return {
    left: x,
    top: -BD,
    width: w,
    height: H + 2 * BD + tE,
    background: `${bottom}, ${board}`,
    borderRadius: left ? '3px 0 0 3px' : '0 3px 3px 0',
  }
}
/** A page-block side edge e px wide, shaded darker outward */
function edgeStyle(g: Geo, left: boolean, e: number): CSSProperties {
  return {
    left: left ? -e : g.W,
    top: 1,
    width: e,
    height: g.H - 1,
    boxShadow: `inset ${px(left ? e : -e)} 0 ${px(e)} ${px(-e)} rgb(0 0 0/.12)`,
  }
}
/** The tail strip: the page block's thickness under the pages */
function tailStyle(g: Geo, eL: number, eR: number): CSSProperties {
  const { W, H, tE } = g
  return {
    left: -eL,
    top: H,
    width: W + eL + eR,
    height: tE,
    boxShadow: `inset 0 ${px(-tE)} ${px(tE)} ${px(-tE)} rgb(0 0 0/.15)`,
  }
}
/** The gutter: 8 % of W centred on the spine, lifted over a turning book's pages */
const gutterStyle = (g: Geo, z: boolean): CSSProperties => ({
  left: g.pw - g.W * 0.04,
  top: 0,
  width: g.W * 0.08,
  height: g.H,
  transform: z ? 'translateZ(.5px)' : undefined,
})

/** One page half of the open book: view v's side, placed. */
interface PagePart {
  v: number
  side: 'L' | 'R'
  style: CSSProperties
}
/** The book's still parts, back to front. */
export interface Shell {
  transform: string | undefined
  boards: CSSProperties[]
  edges: CSSProperties[]
  tail: CSSProperties | null
  pages: PagePart[]
  gutter: CSSProperties | null
}
const half = (g: Geo, v: number, side: 'L' | 'R'): PagePart => ({
  v,
  side,
  style: { left: side === 'L' ? 0 : g.pw, top: 0, width: g.pw, height: g.H },
})
const leftBoard = (g: Geo, e: number) =>
  boardStyle(g, true, -g.BD - e, g.pw + g.BD + e)
const rightBoard = (g: Geo, e: number) =>
  boardStyle(g, false, g.pw, g.pw + g.BD + e)
/** a board leaf's box (the cover past the page block by BD) */
const boardBox = (g: Geo) => ({
  left: g.pw,
  top: -g.BD,
  width: g.pw + g.BD,
  height: g.H + 2 * g.BD,
})

/** The closed front cover: the right board with the cover face over it, shifted half a page left. */
export function frontShell(g: Geo): Shell & { cover: CSSProperties } {
  return {
    transform: `translateX(${px(-g.pw / 2)})`,
    boards: [rightBoard(g, g.eMax)],
    edges: [edgeStyle(g, false, g.eMax)],
    tail: null,
    pages: [],
    gutter: null,
    cover: {
      ...boardBox(g),
      borderRadius: '1px 3px 3px 1px',
      overflow: 'hidden',
    },
  }
}
/** The closed back cover: the left board, its outside up, shifted half a page right. */
export function backShell(g: Geo): Shell & { back: CSSProperties } {
  return {
    transform: `translateX(${px(g.pw / 2)})`,
    boards: [leftBoard(g, g.eMax)],
    edges: [edgeStyle(g, true, g.eMax)],
    tail: null,
    pages: [],
    gutter: null,
    back: {
      ...boardBox(g),
      left: -g.BD,
      background: `linear-gradient(270deg, rgb(0 0 0/.18), rgb(0 0 0/0) 6%), ${g.board}`,
      borderRadius: '3px 1px 1px 3px',
    },
  }
}
/** The open book at rest on spread view v (0 < v < n − 1). */
export function openShell(g: Geo, v: number): Shell {
  const [eL, eR] = edgesOf(g, readOf(g, v))
  return {
    transform: undefined,
    boards: [leftBoard(g, eL), rightBoard(g, eR)],
    edges: [edgeStyle(g, true, eL), edgeStyle(g, false, eR)],
    tail: tailStyle(g, eL, eR),
    pages: [half(g, v, 'L'), half(g, v, 'R')],
    gutter: gutterStyle(g, false),
  }
}

/** The board leaf of an opening (a = 0) or closing (a = n − 2) turn. */
interface BoardLeaf {
  style: CSSProperties
  face: CSSProperties
  /** the endpaper's inset on the leaf: its back when opening, its front when closing */
  endpaper: CSSProperties
  frontShade: string
  backShade: string
}
/** The book between views a and a + 1 with the leaf at angle th (0 = view a, 180 = view a + 1). */
export interface TurnShell extends Shell {
  opening: boolean
  casts: CSSProperties[]
  /** null: the paper leaf (paperStrips) */
  board: BoardLeaf | null
}
/** The board leaf's shade alphas at th: front [edge, 35 %, flat], back [edge, flat]. */
export function boardShades(th: number) {
  const s = sin(th)
  return {
    front: [0.22 * s, 0.06 * s, th < 90 ? (0.28 * th) / 90 : 0] as const,
    back: [0.2 * s, th > 90 ? (0.3 * (180 - th)) / 90 : 0] as const,
  }
}
const black = (a: number) => `rgb(0 0 0/${String(a)})`
export function turnShell(g: Geo, a: number, th: number): TurnShell {
  const { H, pw, n } = g
  const opening = a === 0
  const closing = a === n - 2
  const mid = !opening && !closing
  const s = sin(th)
  const f = th / 180
  const r0 = readOf(g, a)
  const [eL, eR] = edgesOf(g, r0 + (readOf(g, a + 1) - r0) * f)
  const tx = opening ? -(pw / 2) * (1 - f) : closing ? (pw / 2) * f : 0
  const casts: CSSProperties[] = []
  if (!closing && th > 0 && th < 178) {
    casts.push({
      left: pw,
      top: 0,
      width: pw * (0.12 + 0.55 * (1 - f)),
      height: H,
      background: `linear-gradient(90deg, ${black(0.34 * s)}, rgb(0 0 0/0))`,
    })
  }
  if (!opening && th > 92) {
    const castL = (0.35 * pw * (th - 90)) / 90
    casts.push({
      left: pw - castL,
      top: 0,
      width: castL,
      height: H,
      background: `linear-gradient(270deg, ${black(0.26 * s)}, rgb(0 0 0/0))`,
    })
  }
  const sh = boardShades(th)
  const [f0, f1, f2] = sh.front
  const [b0, b1] = sh.back
  return {
    transform: `translateX(${px(tx)})`,
    boards: [
      ...(opening ? [] : [leftBoard(g, eL)]),
      ...(closing ? [] : [rightBoard(g, eR)]),
    ],
    edges: [
      ...(opening ? [] : [edgeStyle(g, true, eL)]),
      ...(closing ? [] : [edgeStyle(g, false, eR)]),
    ],
    tail: mid ? tailStyle(g, eL, eR) : null,
    pages: [
      ...(opening ? [] : [half(g, a, 'L')]),
      ...(closing ? [] : [half(g, a + 1, 'R')]),
    ],
    gutter: mid ? gutterStyle(g, true) : null,
    opening,
    casts,
    board: mid
      ? null
      : {
          style: {
            ...boardBox(g),
            transform: `translateZ(1px) rotateY(${String(-th)}deg)`,
            willChange: 'transform',
          },
          face: { background: g.board, borderRadius: '0 3px 3px 0' },
          endpaper: opening
            ? { left: g.BD, top: g.BD, right: 0, bottom: g.BD }
            : { left: 0, top: g.BD, right: g.BD, bottom: g.BD },
          frontShade: `linear-gradient(90deg, ${black(f0)}, ${black(f1)} 35%, rgb(0 0 0/0) 70%), ${black(f2)}`,
          backShade: `linear-gradient(270deg, ${black(b0)}, rgb(0 0 0/0) 40%), ${black(b1)}`,
        },
  }
}

/** the paper leaf's strip count */
const STRIPS = 12
/** One strip of the paper leaf: its box, where the page faces sit in it, and its shades. */
export interface Strip {
  style: CSSProperties
  /** the strip's angle from the flat right page, degrees */
  angle: number
  /** the front (view a, right) and back (view a + 1, left) page x within the strip */
  frontX: number
  backX: number
  /** paper sheen, front and back shade alphas */
  hi: number
  front: number
  back: number
}
/**
 * The paper leaf: 12 nested strips, each bent 10°·sin θ·i/12 past the one
 * before, so the free edge leads mid-turn and the leaf lies flat at 0 and 180.
 */
export function paperStrips(g: Geo, th: number): Strip[] {
  const { pw, H } = g
  const sw = pw / STRIPS
  const s = sin(th)
  const bend = (i: number) => (10 * s * i) / STRIPS
  // the strips' bends sum to 5·sin θ·(STRIPS − 1); the leaf's middle sits at th
  let angle = th - (5 * s * (STRIPS - 1)) / 2
  return Array.from({ length: STRIPS }, (_, i) => {
    angle += bend(i)
    const first = i === 0
    return {
      style: {
        position: 'absolute',
        left: first ? pw : sw,
        top: 0,
        width: sw + 1.5,
        height: H,
        transformStyle: 'preserve-3d',
        transformOrigin: 'left center',
        transform: first
          ? `translateZ(1px) rotateY(${String(-angle)}deg)`
          : `rotateY(${String(-bend(i))}deg)`,
      },
      angle,
      frontX: -i * sw,
      backX: (i + 1) * sw - pw,
      hi: 0.16 * s * Math.sin((Math.PI * i) / STRIPS),
      front: angle < 90 ? (0.34 * angle) / 90 : 0,
      back: angle > 90 ? (0.3 * (180 - angle)) / 90 : 0,
    }
  })
}

/** the reader's turning state: the leaf between views a and a + 1 at th */
export interface Turn {
  a: number
  th: number
  kind: 'anim' | 'drag' | 'lift'
}
/** a turn's duration: `full` per 180°, 200 ms at least */
export const turnMs = (full: number, th0: number, th1: number) =>
  Math.max(200, (full * Math.abs(th1 - th0)) / 180)
/** How the shown view follows a new `view`: a crossfade, or a leaf turned from th0 to th1. */
export function followPlan(
  view: number,
  shown: number,
  n: number,
  reduce: boolean,
  lift: Turn | null,
): { fade: number } | { a: number; th0: number; th1: number; ms: number } {
  if (reduce) return { fade: 160 }
  if (Math.abs(view - shown) > 1) return { fade: 240 }
  const fwd = view > shown
  const a = Math.min(view, shown)
  const th0 = lift?.a === a ? lift.th : fwd ? 0 : 180
  const th1 = fwd ? 180 : 0
  const full = a === 0 || a === n - 2 ? BOARD_MS : TURN_MS
  return { a, th0, th1, ms: turnMs(full, th0, th1) }
}
/** view v stepped by d within [0, n − 1], or null when it stays */
export function stepFrom(v: number, d: number, n: number): number | null {
  const t = clamp(v + d, 0, n - 1)
  return t === v ? null : t
}

const KEY_STEP: ReadonlyMap<string, number> = new Map([
  ['ArrowRight', 1],
  ['PageDown', 1],
  ['ArrowLeft', -1],
  ['PageUp', -1],
])
/** The reader's step for a key event, or null when the event is not ours. */
export function readerKey(e: KeyboardEvent): number | 'home' | 'end' | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  const t = e.target as Partial<Element> | null
  if (t?.closest?.('input,textarea,select,[contenteditable]')) return null
  if (e.key === 'Home') return 'home'
  if (e.key === 'End') return 'end'
  return KEY_STEP.get(e.key) ?? null
}

/** May a page on `side` be dragged (or its corner lifted) while view `shown` rests? */
export const canDrag = (side: 'L' | 'R', shown: number, n: number) =>
  side === 'R' ? shown >= 1 && shown <= n - 3 : shown >= 2 && shown <= n - 2
/** The leaf angle under x: 0 at the right edge, 90 over the spine, 180 at the left edge. */
export const thetaAt = (x: number, spine: number, span: number) =>
  (Math.acos(clamp((x - spine) / span, -1, 1)) * 180) / Math.PI
/** The cursor label over a side of view `shown`. */
export const cursorOf = (shown: number, n: number, side: 'L' | 'R') =>
  shown === 0 ? 'Open' : shown === n - 1 ? '←' : side === 'R' ? '→' : '←'
/**
 * A pointer move dx, dy px from its press, not dragging yet: a touch / pen
 * moving mostly down is the page scroll; past 6 px (touch: sideways) it drags.
 */
export function moveIntent(
  pointerType: string,
  dx: number,
  dy: number,
): 'scroll' | 'drag' | 'wait' {
  const mouse = pointerType === 'mouse'
  if (!mouse && dy > 6 && dy > dx) return 'scroll'
  const moved = mouse ? Math.hypot(dx, dy) > 6 : dx > 6 && dx >= dy
  return moved ? 'drag' : 'wait'
}
/** The corner to lift under book point (x, y) of a W × H reader on view `shown`, or null. */
export function liftAt(
  x: number,
  y: number,
  W: number,
  H: number,
  shown: number,
  n: number,
): { a: number; th0: number; th: number } | null {
  if (y < 0 || y > H) return null
  if (x > W - CORNER && x <= W + 8 && canDrag('R', shown, n)) {
    return { a: shown, th0: 0, th: 10 }
  }
  if (x < CORNER && x >= -8 && canDrag('L', shown, n)) {
    return { a: shown - 1, th0: 180, th: 170 }
  }
  return null
}
/** The step of a click at book x on `side`: a closed book opens only on the book itself. */
export function clickStep(
  x: number,
  side: 'L' | 'R',
  g: Pick<Geo, 'pw' | 'n' | 'BD'>,
  shown: number,
): number {
  const onBook = x >= g.pw / 2 - g.BD && x <= (3 * g.pw) / 2 + g.BD
  if (shown === 0) return onBook ? 1 : 0
  if (shown === g.n - 1) return onBook ? -1 : 0
  return side === 'R' ? 1 : -1
}
/**
 * A drag released at th: past the spine or flung (> 0.5 px/ms) it turns,
 * else it springs back; a pointer rested > 100 ms before release flings nothing.
 */
export function releasePlan(
  fwd: boolean,
  th: number,
  vx: number,
  restMs: number,
  shown: number,
): { to: number; target: number; ms: number } {
  const v = restMs > 100 ? 0 : vx
  const done = fwd ? th > 90 || v < -0.5 : th < 90 || v > 0.5
  const to = fwd === done ? 180 : 0
  const step = fwd ? 1 : -1
  return {
    to,
    target: done ? shown + step : shown,
    ms: turnMs(TURN_MS, th, to),
  }
}

/** The GL pose (a, θ) of the reader: the turn, or the rest; the closed back = the back board at 180. */
export const glPose = (
  turn: Turn | null,
  shown: number,
  n: number,
): [number, number] =>
  turn ? [turn.a, turn.th] : shown === n - 1 ? [n - 2, 180] : [shown, 0]
/** the leaf rises toward the eye past the head mid-turn: the canvas overhangs the reader by RISE · W */
const RISE = 0.21
/** The GL canvas within a W × H reader box (css px). */
export const glBox = (W: number, H: number) => ({
  x: -0.04 * W,
  y: -RISE * W,
  w: 1.08 * W,
  h: H + RISE * W + 0.05 * H,
})
/** The canvas backing store: at least 2× the box, capped so its long side stays within 4096 px. */
export function backingSize(box: { w: number; h: number }, dpr: number) {
  const k = Math.min(Math.max(2, dpr), 4096 / Math.max(box.w, box.h))
  return { w: Math.round(box.w * k), h: Math.round(box.h * k) }
}
/** the GL page texture size for a W px reader */
export const pagePxOf = (W: number) => (W >= 1600 ? 2048 : 1024)
