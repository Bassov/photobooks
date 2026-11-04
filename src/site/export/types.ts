import type { ReactElement } from 'react'
import type { LibraryMeta, PublishedRevision } from '../../project'

/** One file of the exported site; `path` is site-root relative, `/`-separated. */
export interface SiteFile {
  path: string
  bytes: Uint8Array
}

/** Encoded bytes of one `(assetHash, presetId)` web derivative. */
export interface SiteDerivativeInput {
  assetHash: string
  presetId: string
  bytes: Uint8Array
  width: number
  height: number
}

/** Built viewer bundle, copied under `viewer/`; `entry` is one of its paths. */
export interface SiteViewerBundle {
  entry: string
  files: readonly SiteFile[]
}

/** One encoded size of an image; `src` is relative to the page that links it. */
export interface SiteImageSource {
  presetId: string
  src: string
  width: number
  height: number
}

/**
 * A photo with every derivative present in the tree, presets in config order;
 * photos without any derivative are left out, so `sources` is never empty.
 */
export interface SiteImage {
  assetHash: string
  sources: readonly [SiteImageSource, ...SiteImageSource[]]
}

export interface SiteSpreadModel {
  spreadId: string
  /** Resolved frames (parent, overrides, own) in paint order. */
  images: readonly SiteImage[]
}

export interface SiteBookPageModel {
  bookId: string
  title: string
  spreads: readonly SiteSpreadModel[]
  /** Page-relative viewer entry URL, when a bundle is exported. */
  viewerSrc?: string
}

export interface SiteIndexPageModel {
  /** Newest published first. */
  books: readonly { bookId: string; title: string; href: string }[]
  viewerSrc?: string
}

/** Injectable page markup; `renderToStaticMarkup` turns it into HTML. */
export interface SitePageRenderer {
  index: (page: SiteIndexPageModel) => ReactElement
  book: (page: SiteBookPageModel) => ReactElement
}

export interface SiteExportInput {
  meta: LibraryMeta
  /** Frozen revisions, any order; one per book id. */
  revisions: readonly PublishedRevision[]
  /** Encoded derivatives, any order; one per `(assetHash, presetId)`. */
  derivatives: readonly SiteDerivativeInput[]
  viewer?: SiteViewerBundle
  renderer?: SitePageRenderer
}

export interface SiteMissingDerivative {
  assetHash: string
  presetId: string
}

export interface SiteTree {
  /** Sorted by path (code-unit order), unique paths. */
  files: readonly SiteFile[]
  /** Derivatives a published book wants but the input lacks, sorted. */
  missing: readonly SiteMissingDerivative[]
}
