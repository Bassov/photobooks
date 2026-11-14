import type { Book } from '../../core'
import type { DerivedCacheEntry } from '../../assets/derivedCache/types'
import { encodedImageSize } from '../../derivatives/encodedImageSize'
import { sha256Hex } from '../../lib/sha256Hex'
import { DERIVATIVE_PRESETS } from '../../derivatives/plan'
import type {
  DerivativeResult,
  DerivativeSourceRequest,
} from '../../derivatives/pool'
import {
  bookPublishStatus,
  displayBookTitle,
  publishBook,
  siteAssetIds,
  type LibraryMeta,
  type LibraryStorage,
  type PublishedRevision,
} from '../../project'
import type {
  SiteExportMessage,
  SiteExportRequest,
} from '../../site/export/site-export.worker'
import type {
  SiteDerivativeInput,
  SiteViewerBundle,
} from '../../site/export/types'
import { siteMetaOf } from '../../site/siteModel'
import type { SiteDirectoryHandle } from '../../site/export/writeSiteTree'
import { getSiteSettings } from '../siteSettingsStore'
import type { ExportSiteEvent } from './exportSiteStore'
import { exportPercent } from './exportSiteText'

type AssetRecord = Book['assets'][string]

export interface SiteDerivativeDeps {
  request: (
    requests: readonly DerivativeSourceRequest[],
  ) => Promise<DerivativeResult[]>
  get: (
    assetHash: string,
    presetId: string,
  ) => Promise<DerivedCacheEntry | undefined>
  readSource: (assetId: string, asset: AssetRecord) => Promise<Blob>
}

interface SiteSource {
  assetId: string
  asset: AssetRecord
}

interface HashedSource {
  assetHash: string
  readSource: () => Promise<Blob>
}

/**
 * The photo's content hash and source. A photo the library has no
 * `contentHash` for (a folder import never sets one) is read and hashed
 * here; undefined when that read fails.
 */
async function hashedSource(
  { assetId, asset }: SiteSource,
  deps: SiteDerivativeDeps,
): Promise<HashedSource | undefined> {
  if (asset.contentHash !== undefined) {
    return {
      assetHash: asset.contentHash,
      readSource: () => deps.readSource(assetId, asset),
    }
  }
  try {
    const source = await deps.readSource(assetId, asset)
    return {
      assetHash: await sha256Hex(await source.arrayBuffer()),
      readSource: () => Promise.resolve(source),
    }
  } catch {
    return undefined
  }
}

/** Revisions with the hashes found while exporting written into their assets. */
function withHashes(
  revisions: readonly PublishedRevision[],
  hashes: ReadonlyMap<string, string>,
): PublishedRevision[] {
  return revisions.map((revision) => {
    const assets = { ...revision.book.assets }
    for (const [assetId, asset] of Object.entries(assets)) {
      const contentHash = hashes.get(assetId)
      if (asset.contentHash === undefined && contentHash !== undefined) {
        assets[assetId] = { ...asset, contentHash }
      }
    }
    return { ...revision, book: { ...revision.book, assets } }
  })
}

/**
 * Encoded derivatives for every photo the revisions show, one asset at a
 * time through the derivative pool (cached presets come straight back).
 * Photos without a `contentHash` are hashed from their source bytes first;
 * the returned revisions carry those hashes. A photo or preset that cannot
 * be read or encoded is left out.
 */
export async function collectSiteDerivatives(
  revisions: readonly PublishedRevision[],
  deps: SiteDerivativeDeps,
  progress: (done: number, total: number) => void,
): Promise<{
  revisions: PublishedRevision[]
  derivatives: SiteDerivativeInput[]
}> {
  const wanted = new Map<string, SiteSource>()
  for (const revision of revisions) {
    // The site tree does not depend on derivative order.
    const shown = new Set(siteAssetIds(revision))
    for (const [assetId, asset] of Object.entries(revision.book.assets)) {
      const key = asset.contentHash ?? `asset:${assetId}`
      if (shown.has(assetId) && !wanted.has(key)) {
        wanted.set(key, { assetId, asset })
      }
    }
  }
  const hashes = new Map<string, string>()
  const requested = new Set<string>()
  const derivatives: SiteDerivativeInput[] = []
  let done = 0
  progress(done, wanted.size)
  for (const source of wanted.values()) {
    const hashed = await hashedSource(source, deps)
    if (hashed !== undefined && !requested.has(hashed.assetHash)) {
      requested.add(hashed.assetHash)
      derivatives.push(...(await encodeSource(hashed, deps)))
    }
    if (hashed !== undefined) {
      hashes.set(source.assetId, hashed.assetHash)
    }
    done += 1
    progress(done, wanted.size)
  }
  return { revisions: withHashes(revisions, hashes), derivatives }
}

/** The pool's presets of one photo whose encoded size can be read. */
async function encodeSource(
  { assetHash, readSource }: HashedSource,
  deps: SiteDerivativeDeps,
): Promise<SiteDerivativeInput[]> {
  await deps.request([{ assetHash, readSource }])
  const out: SiteDerivativeInput[] = []
  for (const preset of DERIVATIVE_PRESETS) {
    const entry = await deps.get(assetHash, preset.id)
    if (entry === undefined) {
      continue
    }
    const bytes = new Uint8Array(entry.bytes)
    const size = encodedImageSize(bytes)
    if (size !== undefined) {
      out.push({ assetHash, presetId: preset.id, bytes, ...size })
    }
  }
  return out
}

/** Published revisions of the library's other books, newest first. */
async function otherPublishedRevisions(
  storage: LibraryStorage,
  meta: LibraryMeta,
  openBookId: string,
): Promise<PublishedRevision[]> {
  const out: PublishedRevision[] = []
  for (const bookId of Object.keys(meta.books ?? {})) {
    if (
      bookId === openBookId ||
      bookPublishStatus(meta, bookId) !== 'published'
    ) {
      continue
    }
    const loaded = await storage.loadPublished(bookId)
    if (loaded.ok) {
      out.push(loaded.value)
    }
  }
  return out.sort((a, b) => b.publishedAtMs - a.publishedAtMs)
}

/** Titles for the Options "Books" sentence (other published books, newest first). */
export async function otherPublishedTitles(
  storage: LibraryStorage | null,
  openBookId: string,
): Promise<string[]> {
  if (storage === null) {
    return []
  }
  const meta = await storage.getLibrary()
  if (!meta.ok) {
    return []
  }
  const others = await otherPublishedRevisions(storage, meta.value, openBookId)
  return others.map((revision) => displayBookTitle(revision.book.title))
}

/**
 * Freeze the open book (Designer decision: the snapshot is taken when
 * Export is pressed). Library-backed: `published.json` then `library.json`
 * are saved; the session book stays in memory.
 */
export async function freezeForExport(
  book: Book,
  storage: LibraryStorage | null,
  nowMs: number,
): Promise<{ meta: LibraryMeta; revisions: PublishedRevision[] }> {
  if (storage === null) {
    // No library: the session's site settings (S2 keeps them in memory).
    const site = getSiteSettings()
    const { meta, revision } = publishBook(
      Object.keys(site).length === 0 ? {} : { site },
      book,
      nowMs,
    )
    return { meta, revisions: [revision] }
  }
  const current = await storage.getLibrary()
  if (!current.ok) {
    throw new Error(`Library unavailable: ${current.code}`)
  }
  const { meta, revision } = publishBook(current.value, book, nowMs)
  const saved = await storage.savePublished(revision)
  if (!saved.ok) {
    throw new Error(`published.json not saved: ${saved.code}`)
  }
  const updated = await storage.updateLibrary(meta)
  if (!updated.ok) {
    throw new Error(`library.json not saved: ${updated.code}`)
  }
  const others = await otherPublishedRevisions(storage, meta, book.id)
  return { meta, revisions: [revision, ...others] }
}

export interface ExportSiteRunDeps {
  book: Book
  storage: LibraryStorage | null
  folder: FileSystemDirectoryHandle
  now: () => number
  requestWrite: (folder: FileSystemDirectoryHandle) => Promise<boolean>
  derivatives: SiteDerivativeDeps
  /** The built site viewer every exported page links. */
  loadViewer: () => Promise<SiteViewerBundle>
  /** Posts the request; calls `onMessage` for each worker message. */
  runWorker: (
    request: SiteExportRequest,
    transfer: Transferable[],
    onMessage: (message: SiteExportMessage) => void,
  ) => void
  dispatch: (event: ExportSiteEvent) => boolean
}

/**
 * One Export: permission (first, inside the click), freeze, derivatives,
 * then prerender + writes in the worker. Every outcome ends in `done` or
 * `failed`; nothing runs when an export is already going.
 */
export async function runExportSite(deps: ExportSiteRunDeps): Promise<void> {
  const folder = deps.folder.name
  if (!deps.dispatch({ type: 'start' })) {
    return
  }
  const permitted = deps.requestWrite(deps.folder)
  const fail = (code: 'permission' | 'unknown') =>
    deps.dispatch({ type: 'failed', code, folder })
  try {
    if (!(await permitted)) {
      fail('permission')
      return
    }
    const frozen = await freezeForExport(deps.book, deps.storage, deps.now())
    const { revisions, derivatives } = await collectSiteDerivatives(
      frozen.revisions,
      deps.derivatives,
      (done, total) => {
        deps.dispatch({
          type: 'progress',
          phase: 'prepare',
          percent: exportPercent('prepare', done, total),
        })
      },
    )
    const viewer = await deps.loadViewer()
    const request: SiteExportRequest = {
      folder: deps.folder as unknown as SiteDirectoryHandle,
      input: {
        meta: frozen.meta,
        site: siteMetaOf(frozen.meta),
        revisions,
        derivatives,
        viewer,
      },
    }
    const transfer = [...derivatives, ...viewer.files].map(
      (file) => file.bytes.buffer as ArrayBuffer,
    )
    await new Promise<void>((resolve) => {
      deps.runWorker(request, transfer, (message) => {
        if ('phase' in message) {
          deps.dispatch({
            type: 'progress',
            phase: message.phase,
            percent: exportPercent(message.phase, message.done, message.total),
          })
          return
        }
        if ('failed' in message) {
          deps.dispatch({ type: 'failed', code: message.failed.code, folder })
        } else {
          deps.dispatch({ type: 'done', summary: message.done, folder })
        }
        resolve()
      })
    })
  } catch {
    fail('unknown')
  }
}
