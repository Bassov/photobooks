import type { Book } from '../core'
// Not the barrel: it would pull the zod schemas into the viewer entry.
import { getSpreadSizeMm } from '../core/geometry/spreadSize'
import { pageLabel, pagesOf, pagesText } from '../core/pages'
import { resolveParentFrames } from '../core/parentSpreads'
import { displayBookTitle } from '../project/bookTitle'
import type { SiteBookFacts, SiteCatalogBook } from './siteInput'

/**
 * Room view label (D40): view 0 `Cover`, view v the pages of spread v − 1
 * (`Page 1 of N`, `Pages 2–3 of N`, a single last page `Page N of N`), view
 * n + 1 `Back cover`.
 */
export function viewLabel(view: number, n: number): string {
  if (view <= 0) return 'Cover'
  if (view > n) return 'Back cover'
  const label = pageLabel(view - 1, n)
  const pages = label.includes('–') ? `Pages ${label}` : `Page ${label}`
  return `${pages} of ${String(pagesOf(n))}`
}

/** The page side of a single-page spread (first: right, last: left); none for two pages. */
export function spreadSide(
  book: Book,
  spread: number,
): 'left' | 'right' | undefined {
  if (getSpreadSizeMm(book, spread).pageCount === 2) return undefined
  return spread === 0 ? 'right' : 'left'
}

/** `{n} × {m} cm` from millimetres, one decimal at most. */
const cm = (mm: number) => String(Math.round(mm) / 10)

/** The room's meta line: `2024 · 20 pages · 19 × 23 cm`. */
export function roomMeta(
  b: Pick<SiteCatalogBook, 'year' | 'pageCount' | 'trimMm'>,
): string {
  return `${String(b.year)} · ${pagesText(b.pageCount)} · ${cm(b.trimMm.w)} × ${cm(b.trimMm.h)} cm`
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

/** Spread width / height: two trim pages side by side. */
export function spreadRatio(trim: {
  widthMm: number
  heightMm: number
}): number {
  return (2 * trim.widthMm) / trim.heightMm
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

/** A phone room slide: the cover (no `page`) or a `siteSlides` entry, with its view and label. */
export interface RoomSlide {
  view: number
  label: string
  page?: SiteSlide
}

/** The page number of a one-page slide: page 1 on spread 0, else 2s (left) / 2s + 1 (right). */
function slidePage(s: SiteSlide): number {
  if (s.spread === 0) return 1
  return 2 * s.spread + (s.side === 'right' ? 1 : 0)
}

/** Phone slides (D40): the cover, then `siteSlides`, labelled `Page 4 of 20` / `Pages 6–7 of 20`. */
export function roomSlides(book: Book): RoomSlide[] {
  const n = book.spreads.length
  const total = String(pagesOf(n))
  return [
    { view: 0, label: 'Cover' },
    ...siteSlides(book).map((page) => ({
      view: page.spread + 1,
      label:
        page.side === 'both'
          ? viewLabel(page.spread + 1, n)
          : `Page ${String(slidePage(page))} of ${total}`,
      page,
    })),
  ]
}

/** The first slide showing view `view`; past the last one (the back cover), the last slide. */
export function slideOfView(
  slides: readonly RoomSlide[],
  view: number,
): number {
  const i = slides.findIndex((s) => s.view >= view)
  return i < 0 ? slides.length - 1 : i
}
