import type { Book } from '../core'
import type { BookObjectFmt } from '../render/bookObjectLayout'

/** Site settings shown on every page. */
export interface SiteMeta {
  title: string
  author?: string
  /** `https://…`, no trailing slash; absent → no canonical / absolute URLs. */
  url?: string
}

/** One photo: page-relative `src` + `srcset` (`a.webp 480w, …`) and its size. */
export interface ImageRef {
  src: string
  srcset: string
  w: number
  h: number
}

export interface SiteCatalogBook {
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

/** Page-relative stylesheet and viewer entry URLs. */
export interface SitePageAssets {
  css: readonly string[]
  js?: string
}
