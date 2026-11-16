import type { LibraryMeta, PublishedRevision } from '../../project'
import type { SiteMeta, SitePageAssets, SitePageInput } from '../siteInput'

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
  /** Stylesheets every page links, in order; each one of `files`. */
  css?: readonly string[]
  /** Font files every page preloads; each one of `files`. */
  preload?: readonly string[]
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
interface SiteImage {
  assetHash: string
  sources: readonly [SiteImageSource, ...SiteImageSource[]]
}

export interface SiteSpreadModel {
  spreadId: string
  /** Resolved frames (parent, overrides, own) in paint order. */
  images: readonly SiteImage[]
}

/**
 * Injectable page renderer: one complete HTML document per page (catalog
 * newest published first; book pages with page-relative URLs).
 */
type SitePageRenderer = (input: SitePageInput, assets: SitePageAssets) => string

export interface SiteExportInput {
  meta: LibraryMeta
  /** Frozen revisions, any order; one per book id. */
  revisions: readonly PublishedRevision[]
  /** Encoded derivatives, any order; one per `(assetHash, presetId)`. */
  derivatives: readonly SiteDerivativeInput[]
  /** Site settings; absent → title `Photobooks`, no author, no URL. */
  site?: SiteMeta
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
  /** Derivatives a published book wants but the input lacks: by asset hash, presets in config order. */
  missing: readonly SiteMissingDerivative[]
}
