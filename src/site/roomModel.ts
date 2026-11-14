/*
 * The reading room's numbers (SiteRoom): where the reader and the rows sit for
 * a box, how long a turn runs before the Play dwell, which Fullscreen slide a
 * view opens and which events pause Play. Pure; SiteRoom draws them.
 */
import type { SiteCatalogBook } from './siteInput'

/** The box the server lays the room out for. */
export const SERVER_BOX = { vw: 1440, vh: 900 } as const

/** [kx, ky, ty, dx]: the painted book's width / W, height / H, top offset / H, centre right of the box centre / W. */
export type ReaderBody = readonly [number, number, number, number]

/** The visible GL book (site-stand-v7 R) inside the reader's box, per format. */
export const GL_BODY: Readonly<Record<SiteCatalogBook['fmt'], ReaderBody>> = {
  portrait: [0.8747, 0.8496, 0.0784, 0],
  landscape: [0.907, 0.894, 0.0533, 0.0006],
  square: [0.881, 0.8607, 0.0729, 0.0002],
}
/** The CSS reader (`?gl=0`, no WebGL2, the prerender) paints its whole box. */
export const CSS_BODY: ReaderBody = [1, 1, 0, 0]

/** The reader's box: width (its height is width / R) and top-left corner. */
interface ReaderBox {
  w: number
  left: number
  top: number
}

/** A row's horizontal extent. */
type RowX = { left: number; width: number } | { left: number; right: number }

/** Desktop wider than this lays the foot row on the 12-column grid. */
const NARROW_MAX = 640

/** A desktop box wide enough for the one foot row. */
export const wideDesk = (vw: number): boolean => vw > NARROW_MAX

/** Phone landscape side column (the back link and the buttons). */
export const LAND_SIDE = 136

export interface LandGeo {
  /** side: the rows beside the reader; else one foot row under it */
  side: boolean
  reader: ReaderBox
  /** the label row (side) or the foot row (foot) */
  rowTop: number
}

/** Phone landscape: the larger of the side layout and the foot layout. */
export function landGeo(vw: number, vh: number, R: number): LandGeo {
  const sideW = Math.min(vw - 2 * LAND_SIDE, (vh - 24) * R)
  const footW = Math.min(vw - 32, (vh - 64) * R)
  const side = sideW >= footW
  const w = side ? sideW : footW
  const h = w / R
  return {
    side,
    reader: {
      w,
      left: (vw - w) / 2,
      top: side ? (vh - h) / 2 : 8 + (vh - 64 - h) / 2,
    },
    rowTop: vh - 52,
  }
}

export interface DeskGeo {
  wide: boolean
  /** the grid's side margin */
  margin: number
  reader: ReaderBox
  footTop: number
  /** wide: about · pager · actions on the grid; narrow: the pager, then the actions row */
  about: { left: number; width: number } | null
  pager: RowX
  actions: RowX
  actionsTop: number
}

/** The head's bottom (wide desktop centres the book under it). */
const HEAD = 44

/**
 * Desktop (grid margin 24 / 16, gutter 16 / 12, 12 / 4 columns). Wide: the
 * visible book (`body`) centred in [44, footTop = h − 54], ≥ 32 above and
 * below, ≥ 64 each side. Narrow: the book four columns wide at most, centred
 * in [64, h − 104], the pager 24 under it, the actions row 16 under that.
 */
export function deskGeo(
  vw: number,
  vh: number,
  R: number,
  body: ReaderBody,
): DeskGeo {
  const wide = wideDesk(vw)
  const M = wide ? 24 : 16
  const G = wide ? 16 : 12
  const C = wide ? 12 : 4
  const col = (vw - 2 * M - (C - 1) * G) / C
  const span = (k: number) => k * col + (k - 1) * G
  const x = (k: number) => M + k * (col + G)
  if (!wide) {
    const room = vh - 64 - 104
    const w = Math.max(200, Math.min(span(4), room * R))
    const top = 64 + (room - w / R) / 2
    const footTop = top + w / R + 24
    return {
      wide,
      margin: M,
      reader: { w, left: (vw - w) / 2, top },
      footTop,
      about: null,
      pager: { left: M, right: M },
      actions: { left: M, right: M },
      actionsTop: footTop + 44 + 16,
    }
  }
  const [kx, ky, ty, dx] = body
  const footTop = vh - 54
  const w = Math.max(
    200,
    Math.min((vw - 128) / kx, ((footTop - HEAD - 64) * R) / ky),
  )
  const H = w / R
  return {
    wide,
    margin: M,
    reader: {
      w,
      left: (vw - w) / 2 - dx * w,
      top: (HEAD + footTop) / 2 - (ky * H) / 2 - ty * H,
    },
    footTop,
    about: { left: x(0), width: span(4) },
    pager: { left: x(4), width: span(4) },
    actions: { left: x(9), width: span(3) },
    actionsTop: footTop,
  }
}

/**
 * How long a desktop turn from view `a` to `z` runs (Play starts its dwell
 * after it): one step 820 ms, 1000 ms when it opens or closes a cover; a jump
 * or reduced motion 240 ms. `last` is the back cover's view.
 */
export function turnMs(
  a: number,
  z: number,
  last: number,
  reduced: boolean,
): number {
  if (reduced || Math.abs(z - a) !== 1) return 240
  return Math.min(a, z) === 0 || Math.max(a, z) === last ? 1000 : 820
}

/** The Fullscreen slide (spread) a view opens: the cover spread 0, the back cover the last. */
export const lightboxSlide = (view: number, n: number): number =>
  Math.min(Math.max(view - 1, 0), n - 1)

/** Play toggles itself (its click, Enter, Space); any other key or press pauses it. */
export function pausesPlay(e: Event): boolean {
  const t = e.target as Partial<Element> | null
  const own = t?.closest?.('[data-testid="site-play"]') != null
  if (!own) return true
  return e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' '
}
