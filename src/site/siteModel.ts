import type { Book } from '../core'
// Not the barrel: it would pull the zod schemas into the viewer entry.
import { getSpreadSizeMm } from '../core/geometry/spreadSize'
import { pageLabel, pagesOf, pagesText } from '../core/pages'
import { resolveParentFrames } from '../core/parentSpreads'
import { displayBookTitle } from '../project/bookTitle'
import type { SiteBookFacts } from './siteInput'

/** Viewports below this width use the narrow site layout (spec §4). */
const NARROW_BELOW = 768
/** Widest stage, and the stage width the server renders at. */
export const STAGE_MAX = 760
const STAGE_MIN = 280
/**
 * Book page height around the stage: header + top pad + title block + stage
 * margin + pager margin + pager + bottom pad (wide 94.85 title block; narrow
 * adds Share under the meta).
 */
const WIDE_CHROME_H = 64 + 16 + 94.85 + 32 + 24 + 36 + 32
const NARROW_CHROME_H = 56 + 8 + 138.85 + 20 + 16 + 36 + 20
/** The title block's "All books" link + gap (32 + 4), absent in a preview. */
const ALL_BOOKS_H = 32 + 4

/** Slides of a book with `n` spreads: the cover, then every spread. */
export function slideCount(n: number): number {
  return n + 1
}

/** Pager text: `Cover`, then `Page 1 · 1 / n`, `Pages 2–3 · 2 / n` … */
export function slideLabel(slide: number, n: number): string {
  if (slide === 0) return 'Cover'
  const label = pageLabel(slide - 1, n)
  const pages = label.includes('–') ? `Pages ${label}` : `Page ${label}`
  return `${pages} · ${String(slide)} / ${String(n)}`
}

/**
 * A single first / last page sits on its own side of the spread box (the
 * cover, spread index -1, counts as two pages).
 */
export function slideSide(
  book: Book,
  slide: number,
): 'left' | 'right' | undefined {
  if (getSpreadSizeMm(book, slide - 1).pageCount === 2) {
    return undefined
  }
  return slide === 1 ? 'right' : 'left'
}

/** `#p{first page}` of slide `slide`; the cover (and out of range) has none. */
export function hashForSlide(slide: number, n: number): string {
  if (slide < 1 || slide > n) return ''
  const spread = slide - 1
  return `#p${String(spread === 0 ? 1 : spread * 2)}`
}

/** The slide holding page N of `#pN`; anything else opens the cover. */
export function slideForHash(hash: string, n: number): number {
  const match = /^#p([1-9]\d{0,5})$/.exec(hash)
  if (match === null) return 0
  const page = Number(match[1])
  if (page > pagesOf(n)) return 0
  // Page 1 → spread 0, pages 2–3 → spread 1, …
  return Math.floor(page / 2) + 1
}

export function isNarrow(vw: number): boolean {
  return vw < NARROW_BELOW
}

function sidePad(vw: number): number {
  return isNarrow(vw) ? 20 : 32
}

/**
 * Stage width: at most 760, the content width and the height left for the
 * spread; at least 280 unless the content is narrower. Without the "All
 * books" link (`allBooks: false`) the spread gets its 36 px.
 */
export function stageWidth({
  vw,
  vh,
  ratio,
  allBooks = true,
}: {
  vw: number
  vh: number
  ratio: number
  allBooks?: boolean
}): number {
  const content = Math.max(0, vw - 2 * sidePad(vw))
  const chrome =
    (isNarrow(vw) ? NARROW_CHROME_H : WIDE_CHROME_H) -
    (allBooks ? 0 : ALL_BOOKS_H)
  const availH = vh - chrome
  const fit = Math.min(STAGE_MAX, availH * ratio)
  return Math.min(content, Math.max(STAGE_MIN, fit))
}

/** Spread width / height: two trim pages side by side. */
export function spreadRatio(trim: {
  widthMm: number
  heightMm: number
}): number {
  return (2 * trim.widthMm) / trim.heightMm
}

/** `sizes` of a photo spanning `share` of the spread width. */
export function frameSizes(share: number): string {
  const s = String(Math.round(share * 10_000) / 10_000)
  const wide = Math.round(STAGE_MAX * Number(s))
  return `(max-width: ${String(NARROW_BELOW - 1)}px) calc((100vw - 40px) * ${s}), min(${String(wide)}px, calc((100vw - 64px) * ${s}))`
}

export function siteTitle(title: string): string {
  return title.trim() === '' ? 'Photobooks' : title
}

/** The home's head (D37): the author, else the site title. */
export function homeHead(site: { title: string; author?: string }): string {
  const author = site.author?.trim() ?? ''
  return author === '' ? siteTitle(site.title) : author
}

/** The home's lead (D37): the intro, else `Photobooks by {author}.`, else none. */
export function homeLead(site: {
  author?: string
  intro?: string
}): string | undefined {
  const intro = site.intro?.trim() ?? ''
  if (intro !== '') return intro
  const author = site.author?.trim() ?? ''
  return author === '' ? undefined : `Photobooks by ${author}.`
}

/** Book meta line under the title. */
export function bookMeta(author: string | undefined, pages: number): string {
  const count = pagesText(pages)
  return author === undefined || author === ''
    ? count
    : `by ${author} · ${count}`
}

const INK_ON_DARK = '#F1F3F6'
const INK_ON_LIGHT = '#2E2C2D'
/** Below this cloth luminance the spine text is light (the stand rule). */
const DARK_CLOTH_BELOW = 0.23
const DEFAULT_PAPER = '#FBFAF7'
/** The stand's `ENDPAPER`; books have no endpaper colour of their own. */
const ENDPAPER = '#E9E4DA'

/** WCAG relative luminance of an sRGB `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** D38: the physical book the site shows, from a published revision. */
export function siteBookFacts(
  book: Book,
  publishedAtMs: number,
): SiteBookFacts {
  const cloth = book.cover.style.backFill
  const spineText = book.cover.spine.text.trim()
  return {
    year: new Date(publishedAtMs).getUTCFullYear(),
    trimMm: { w: book.settings.trim.widthMm, h: book.settings.trim.heightMm },
    pageCount: pagesOf(book.spreads.length),
    spine: {
      cloth,
      ink:
        relativeLuminance(cloth) < DARK_CLOTH_BELOW
          ? INK_ON_DARK
          : INK_ON_LIGHT,
      text: spineText === '' ? displayBookTitle(book.title) : spineText,
    },
    paper: book.settings.pageColor ?? DEFAULT_PAPER,
    endpaper: ENDPAPER,
  }
}

/** One phone slide (D40): a page of spread `spread`, or the whole spread. */
export interface SiteSlide {
  spread: number
  side: 'left' | 'right' | 'both'
}

/**
 * Phone slides (D40): a slide per page with a frame on it (parent frames
 * included), blank pages skipped; a two-page spread is one `both` slide
 * when a frame crosses the gutter. Endpapers are not spreads.
 */
export function siteSlides(book: Book): SiteSlide[] {
  const { widthMm: pageW, heightMm: pageH } = book.settings.trim
  return book.spreads.flatMap((spread, index): SiteSlide[] => {
    const rects = resolveParentFrames(book, spread).map(
      ({ frame }) => frame.rect,
    )
    const on = (x0: number, x1: number) =>
      rects.some(
        (r) =>
          r.x < x1 && r.x + r.width > x0 && r.y < pageH && r.y + r.height > 0,
      )
    if (getSpreadSizeMm(book, index).pageCount === 1) {
      const side = index === 0 ? 'right' : 'left'
      return on(0, pageW) ? [{ spread: index, side }] : []
    }
    if (on(pageW, pageW)) {
      return [{ spread: index, side: 'both' }]
    }
    return [
      ...(on(0, pageW) ? [{ spread: index, side: 'left' as const }] : []),
      ...(on(pageW, 2 * pageW)
        ? [{ spread: index, side: 'right' as const }]
        : []),
    ]
  })
}
