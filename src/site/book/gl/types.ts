/*
 * GL-local book input (Designer D38): what the WebGL book needs, in its own
 * terms. The home and the room map site data into it; nothing here reads the
 * site model.
 */

/** The page colour default (D38; the kit's `PAPER`). */
export const PAPER = '#FBFAF7'
/** The endpaper colour default (D38; the kit's `ENDPAPER`). */
export const ENDPAPER = '#E9E4DA'

/** The cover panels as printed: front and back are trim-sized, the spine reads top → bottom. */
export interface GlCoverPanels {
  front: CanvasImageSource
  spine: CanvasImageSource
  back: CanvasImageSource
}

/** Printed page `pageIndex` (0-based) as a painted face. */
export type GlFace = (pageIndex: number) => Promise<CanvasImageSource>

export interface GlBookInput {
  cover: GlCoverPanels
  /** board edges and the open book's boards: the cover cloth (`backFill`) */
  cloth: string
  /** printed pages, `2(n − 1)` for n spreads */
  pageCount: number
  trimMm: { widthMm: number; heightMm: number }
  paper?: string
  endpaper?: string
  face: GlFace
}

/** The input resolved: sizes in cm, colours defaulted. */
export interface GlBook {
  cover: GlCoverPanels
  cloth: string
  pages: number
  /** trim width / height, cm */
  w: number
  h: number
  paper: string
  endpaper: string
  face: GlFace
}

export function glBook(input: GlBookInput): GlBook {
  return {
    cover: input.cover,
    cloth: input.cloth,
    pages: input.pageCount,
    w: input.trimMm.widthMm / 10,
    h: input.trimMm.heightMm / 10,
    paper: input.paper ?? PAPER,
    endpaper: input.endpaper ?? ENDPAPER,
    face: input.face,
  }
}

/**
 * Faces of the open book: the printed pages between the two endpapers (the
 * kit's page count). View 1 = endpaper | page 0; the last view = last page |
 * endpaper.
 */
export const facesOf = (b: Pick<GlBook, 'pages'>): number => b.pages + 2

/** Reader views: 0 the cover, 1 … the spreads, the last one the back cover. */
export const viewsOf = (b: Pick<GlBook, 'pages'>): number => facesOf(b) / 2 + 2

/** Thickness in cm: the kit's `thickCm` (including its 12 px floor at `s` px per cm). */
export const thickCm = (b: Pick<GlBook, 'pages'>, s: number): number =>
  Math.max(0.6 + (facesOf(b) / 2) * 0.1, 12 / s)

/** One side of view `v`: 0 left, 1 right. */
export interface Face {
  v: number
  side: 0 | 1
}

/** The printed page on a face, or null on an endpaper (or past the book). */
export function pageOfFace(b: Pick<GlBook, 'pages'>, f: Face): number | null {
  const page = 2 * (f.v - 1) + f.side - 1
  return page >= 0 && page < b.pages ? page : null
}

/** The view showing printed page `page`. */
export const viewOfPage = (page: number): number =>
  Math.floor((page + 1) / 2) + 1
