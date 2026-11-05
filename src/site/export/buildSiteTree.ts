import { sha256HexSync } from '../../assets/sha256Sync'
import { pagesOf, resolveParentFrames, type Book } from '../../core'
import { DERIVATIVE_PRESETS, resolvePresets } from '../../derivatives/plan'
import {
  bookPublishStatus,
  displayBookTitle,
  siteAssetIds,
  type PublishedRevision,
} from '../../project'
import { bookFormatFromTrim } from '../../render/bookObjectLayout'
import { renderSitePage } from '../renderSitePage'
import type {
  ImageRef,
  SiteCatalogBook,
  SiteMeta,
  SitePageAssets,
} from '../siteInput'
import type {
  SiteDerivativeInput,
  SiteExportInput,
  SiteFile,
  SiteImageSource,
  SiteMissingDerivative,
  SiteSpreadModel,
  SiteTree,
  SiteViewerBundle,
} from './types'

const SITE_MANIFEST_VERSION = 1
export const SITE_MANIFEST_PATH = 'site.json'

/** Book page prefix back to the site root (`books/<key>/index.html`). */
const BOOK_TO_ROOT = '../../'

const encoder = new TextEncoder()

/**
 * `items` unique by `key` (last wins), in default string sort order: UTF-16
 * code units, never `localeCompare`, so output is locale independent.
 */
function sortedBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const byKey = new Map(items.map((item) => [key(item), item]))
  // Every sorted key comes from `byKey`, so no lookup misses.
  return [...byKey.keys()].sort().map((k) => byKey.get(k)) as T[]
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes as Uint8Array<ArrayBuffer>,
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const DEFAULT_SITE: SiteMeta = { title: 'Photobooks' }

/** `<img>` / book page source and the catalog cover source. */
const DISPLAY_PRESET = 'site-display'
const THUMB_PRESET = 'site-thumb'
const SHARE_PRESET = 'site-share'
const WEBP_PRESETS = new Set(
  DERIVATIVE_PRESETS.filter((preset) => preset.mimeType === 'image/webp').map(
    (preset) => preset.id,
  ),
)

/** Cover ink on a photo (library card) and on the bare cloth. */
const INK_ON_PHOTO = '#F5F5F5'
const INK_ON_CLOTH = '#2E2C2D'

/** The revisions `buildSiteTree` exports: published books only, newest first. */
export function publishedRevisions(
  input: Pick<SiteExportInput, 'meta' | 'revisions'>,
): PublishedRevision[] {
  const seen = new Set<string>()
  for (const { bookId } of input.revisions) {
    if (seen.has(bookId)) {
      throw new Error(`Duplicate published revision: ${bookId}`)
    }
    seen.add(bookId)
  }
  const published = input.revisions.filter(
    (revision) =>
      bookPublishStatus(input.meta, revision.bookId) === 'published',
  )
  // Newest first; the stable sort keeps id order between equal times.
  return sortedBy(published, (revision) => revision.bookId).sort(
    (a, b) => b.publishedAtMs - a.publishedAtMs,
  )
}

function derivativeKey(assetHash: string, presetId: string): string {
  return `${assetHash}\u0000${presetId}`
}

function indexDerivatives(
  derivatives: readonly SiteDerivativeInput[],
): Map<string, SiteDerivativeInput> {
  const byKey = new Map<string, SiteDerivativeInput>()
  for (const derivative of derivatives) {
    resolvePresets([derivative.presetId])
    const key = derivativeKey(derivative.assetHash, derivative.presetId)
    if (byKey.has(key)) {
      throw new Error(
        `Duplicate derivative: ${derivative.assetHash} ${derivative.presetId}`,
      )
    }
    byKey.set(key, derivative)
  }
  return byKey
}

/** Content hash per asset id; frames without a hashed asset record miss. */
function assetHashes(book: Book): Map<string | undefined, string | undefined> {
  return new Map(
    Object.entries(book.assets).map(([id, asset]) => [id, asset.contentHash]),
  )
}

/** `/`-separated, no empty / `.` / `..` segments and no `\` (Windows separator). */
function isSafeRelativePath(path: string): boolean {
  return (
    !path.includes('\\') &&
    path
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

function viewerFiles(viewer: SiteViewerBundle): SiteFile[] {
  const paths = new Set<string>()
  for (const { path } of viewer.files) {
    if (!isSafeRelativePath(path) || paths.has(path)) {
      throw new Error(`Invalid viewer path: ${path}`)
    }
    paths.add(path)
  }
  for (const path of [viewer.entry, ...(viewer.css ?? [])]) {
    if (!paths.has(path)) {
      throw new Error(`Viewer entry not in bundle: ${path}`)
    }
  }
  return viewer.files.map(({ path, bytes }) => ({
    path: `viewer/${path}`,
    bytes,
  }))
}

interface ExportedBook {
  revision: PublishedRevision
  title: string
  dir: string
  assetHashes: string[]
}

function exportedBook(revision: PublishedRevision): ExportedBook {
  const { book } = revision
  const hashOf = assetHashes(book)
  const wanted = new Set<string>()
  for (const assetId of siteAssetIds(revision)) {
    const hash = hashOf.get(assetId)
    if (hash !== undefined) {
      wanted.add(hash)
    }
  }
  return {
    revision,
    title: displayBookTitle(book.title),
    dir: `books/${sha256HexSync(revision.bookId).slice(0, 16)}/`,
    assetHashes: [...wanted],
  }
}

/** Root-relative sources per asset hash; assets without any are absent. */
type Sources = [SiteImageSource, ...SiteImageSource[]]
type AssetSources = Map<string, Sources>

async function derivativeFiles(
  wanted: readonly string[],
  derivatives: Map<string, SiteDerivativeInput>,
): Promise<{
  files: SiteFile[]
  sources: AssetSources
  missing: SiteMissingDerivative[]
}> {
  const files: SiteFile[] = []
  const sources: AssetSources = new Map()
  const missing: SiteMissingDerivative[] = []
  for (const assetHash of wanted) {
    const found: SiteImageSource[] = []
    for (const preset of DERIVATIVE_PRESETS) {
      const derivative = derivatives.get(derivativeKey(assetHash, preset.id))
      if (derivative === undefined) {
        missing.push({ assetHash, presetId: preset.id })
        continue
      }
      const ext = preset.mimeType === 'image/jpeg' ? 'jpg' : 'webp'
      const path = `assets/${await sha256Hex(derivative.bytes)}.${ext}`
      files.push({ path, bytes: derivative.bytes })
      found.push({
        presetId: preset.id,
        src: path,
        width: derivative.width,
        height: derivative.height,
      })
    }
    const [first, ...rest] = found
    if (first !== undefined) {
      sources.set(assetHash, [first, ...rest])
    }
  }
  return { files, sources, missing }
}

/** Root-relative spreads of `book`: resolved frames with an exported photo. */
function spreadModels(book: Book, sources: AssetSources): SiteSpreadModel[] {
  const hashOf = assetHashes(book)
  return book.spreads.map((spread) => ({
    spreadId: spread.id,
    images: resolveParentFrames(book, spread).flatMap(({ frame }) => {
      const assetHash = hashOf.get(frame.assetId) ?? ''
      const found = sources.get(assetHash)
      return found === undefined ? [] : [{ assetHash, sources: found }]
    }),
  }))
}

/**
 * Page-relative srcset of a photo: its webp sizes (any size when it has
 * none), `src` = the `preferred` preset when present.
 */
function imageRef(
  sources: Sources,
  prefix: string,
  preferred: string,
): ImageRef {
  const webp = sources.filter((source) => WEBP_PRESETS.has(source.presetId))
  const pool: readonly SiteImageSource[] = webp.length > 0 ? webp : sources
  const main =
    pool.find((source) => source.presetId === preferred) ??
    pool[0] ??
    sources[0]
  const largest = pool.reduce((a, b) => (b.width > a.width ? b : a), main)
  return {
    src: `${prefix}${main.src}`,
    srcset: pool
      .map((source) => `${prefix}${source.src} ${String(source.width)}w`)
      .join(', '),
    w: largest.width,
    h: largest.height,
  }
}

/** Page-relative `og:image`: the JPEG share size, else the display size. */
function shareImage(sources: Sources, prefix: string): string {
  const found =
    sources.find((source) => source.presetId === SHARE_PRESET) ??
    sources.find((source) => source.presetId === DISPLAY_PRESET) ??
    sources[0]
  return `${prefix}${found.src}`
}

/** The frozen book with asset records reduced to their ids (no paths, captions, GPS). */
function siteBook(book: Book): Book {
  return {
    ...book,
    assets: Object.fromEntries(Object.keys(book.assets).map((id) => [id, {}])),
    gallery: [],
  }
}

/** Exported sources of the book's cover front photo, if any. */
function coverSources(book: Book, sources: AssetSources): Sources | undefined {
  const hash = assetHashes(book).get(book.cover.front.assetId)
  return hash === undefined ? undefined : sources.get(hash)
}

function manifest(
  books: readonly (ExportedBook & { spreads: SiteSpreadModel[] })[],
  sources: AssetSources,
  viewerSrc: string | undefined,
): Uint8Array {
  const value = {
    version: SITE_MANIFEST_VERSION,
    /** `JSON.stringify` drops it when there is no bundle. */
    viewer: viewerSrc,
    books: books.map(({ revision, title, dir, assetHashes, spreads }) => ({
      id: revision.bookId,
      title,
      path: dir,
      assets: assetHashes.filter((hash) => sources.has(hash)),
      spreads: spreads.map((spread) => ({
        id: spread.spreadId,
        images: spread.images.map((image) => image.assetHash),
      })),
    })),
    assets: [...sources].map(([hash, found]) => ({
      hash,
      files: found.map(({ presetId, src, width, height }) => ({
        preset: presetId,
        path: src,
        width,
        height,
      })),
    })),
  }
  return encoder.encode(`${JSON.stringify(value)}\n`)
}

/**
 * Pure, deterministic static site: published books from their frozen
 * revisions only, content-addressed derivatives, prerendered pages, the
 * viewer bundle and `site.json`. Same input in any order → identical bytes.
 */
export async function buildSiteTree(input: SiteExportInput): Promise<SiteTree> {
  const renderer = input.renderer ?? renderSitePage
  const site = input.site ?? DEFAULT_SITE
  const derivatives = indexDerivatives(input.derivatives)
  const exported = publishedRevisions(input).map(exportedBook)
  const wanted = [
    ...new Set(exported.flatMap((book) => book.assetHashes)),
  ].sort()
  const assets = await derivativeFiles(wanted, derivatives)
  const books = exported.map((book) => ({
    ...book,
    spreads: spreadModels(book.revision.book, assets.sources),
  }))
  const viewer = input.viewer === undefined ? [] : viewerFiles(input.viewer)
  const viewerSrc =
    input.viewer === undefined ? undefined : `viewer/${input.viewer.entry}`
  const pageAssets = (prefix: string): SitePageAssets => ({
    css: (input.viewer?.css ?? []).map((path) => `${prefix}viewer/${path}`),
    ...(viewerSrc === undefined ? {} : { js: `${prefix}${viewerSrc}` }),
  })

  const pages: SiteFile[] = books.map(({ revision, dir }) => {
    const { book } = revision
    const hashOf = assetHashes(book)
    const images: Record<string, ImageRef> = {}
    for (const assetId of siteAssetIds(revision)) {
      const found = assets.sources.get(hashOf.get(assetId) ?? '')
      if (found !== undefined) {
        images[assetId] = imageRef(found, BOOK_TO_ROOT, DISPLAY_PRESET)
      }
    }
    const cover = coverSources(book, assets.sources)
    return {
      path: `${dir}index.html`,
      bytes: encoder.encode(
        renderer(
          {
            kind: 'book',
            site,
            path: dir,
            catalogHref: BOOK_TO_ROOT,
            book: siteBook(book),
            images,
            ...(cover === undefined
              ? {}
              : { ogImage: shareImage(cover, BOOK_TO_ROOT) }),
          },
          pageAssets(BOOK_TO_ROOT),
        ),
      ),
    }
  })
  const catalog: SiteCatalogBook[] = books.map(({ revision, title, dir }) => {
    const { book } = revision
    const cover = coverSources(book, assets.sources)
    return {
      id: revision.bookId,
      href: dir,
      title,
      pages: pagesOf(book.spreads.length),
      fmt: bookFormatFromTrim(
        book.settings.trim.widthMm,
        book.settings.trim.heightMm,
      ),
      cover: cover === undefined ? null : imageRef(cover, '', THUMB_PRESET),
      ink: cover === undefined ? INK_ON_CLOTH : INK_ON_PHOTO,
      place: 'top',
    }
  })
  const firstCover = books
    .map(({ revision }) => coverSources(revision.book, assets.sources))
    .find((found) => found !== undefined)
  const index: SiteFile = {
    path: 'index.html',
    bytes: encoder.encode(
      renderer(
        {
          kind: 'catalog',
          site,
          path: '',
          books: catalog,
          ...(firstCover === undefined
            ? {}
            : { ogImage: shareImage(firstCover, '') }),
        },
        pageAssets(''),
      ),
    ),
  }

  return {
    // Content-addressed asset paths repeat with the same bytes; one is kept.
    files: sortedBy(
      [
        index,
        ...pages,
        ...assets.files,
        ...viewer,
        {
          path: SITE_MANIFEST_PATH,
          bytes: manifest(books, assets.sources, viewerSrc),
        },
      ],
      (file) => file.path,
    ),
    missing: assets.missing,
  }
}
