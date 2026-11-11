import type { Book } from '../core'
import type { BookObjectFmt } from '../render/bookObjectLayout'

/** Site settings shown on every page. */
export interface SiteMeta {
  title: string
  author?: string
  /** `https://…`, no trailing slash; absent → no canonical / absolute URLs. */
  url?: string
  /** Home lead (D37); absent → `Photobooks by {author}.`. */
  intro?: string
}

/** One photo: page-relative `src` + `srcset` (`a.webp 480w, …`) and its size. */
export interface ImageRef {
  src: string
  srcset: string
  w: number
  h: number
}

/** The physical book the site shows (D38), from the published revision. */
export interface SiteBookFacts {
  /** UTC year of publishing. */
  year: number
  trimMm: { w: number; h: number }
  pageCount: number
  spine: { cloth: string; ink: string; text: string }
  paper: string
  endpaper: string
}

export interface SiteCatalogBook extends SiteBookFacts {
  id: string
  /** Page-relative link to the book page. */
  href: string
  title: string
  pages: number
  fmt: BookObjectFmt
  cover: ImageRef | null
  ink: string
  place: 'top' | 'bottom'
}

/** Site-root relative directory of the page (`''`, `books/<key>/`). */
type PagePath = string

export type SitePageInput =
  | {
      kind: 'catalog'
      site: SiteMeta
      path: PagePath
      books: SiteCatalogBook[]
      /** Page-relative share image (first cover). */
      ogImage?: string
    }
  | {
      kind: 'book'
      site: SiteMeta
      path: PagePath
      /** Page-relative link back to the catalog. */
      catalogHref: string
      /** Frozen published revision; asset records carry nothing but their ids. */
      book: Book
      images: Record<string, ImageRef>
      ogImage?: string
    }

/** `books/<key>/book.json` (D41): the book page input plus its catalog entry. */
export type SiteBookData = Extract<SitePageInput, { kind: 'book' }> & {
  entry: SiteCatalogBook
}

/** Page-relative stylesheet, viewer entry and font preload URLs. */
export interface SitePageAssets {
  css: readonly string[]
  js?: string
  preload?: readonly string[]
}
