import type { Book } from '../../core'
import type { DerivedCacheEntry } from '../../assets/derivedCache/types'
import { encodedImageSize } from '../../derivatives/encodedImageSize'
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
import type { SiteDerivativeInput } from '../../site/export/types'
import type { SiteDirectoryHandle } from '../../site/export/writeSiteTree'
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

/**
 * Encoded derivatives for every photo the revisions show, one asset at a
 * time through the derivative pool (cached presets come straight back).
 * A preset that cannot be encoded or read is left out.
 */
export async function collectSiteDerivatives(
  revisions: readonly PublishedRevision[],
  deps: SiteDerivativeDeps,
  progress: (done: number, total: number) => void,
): Promise<SiteDerivativeInput[]> {
  const wanted = new Map<string, () => Promise<Blob>>()
  for (const revision of revisions) {
    // The site tree does not depend on derivative order.
    const shown = new Set(siteAssetIds(revision))
    for (const [assetId, asset] of Object.entries(revision.book.assets)) {
      const hash = asset.contentHash
      if (shown.has(assetId) && hash !== undefined && !wanted.has(hash)) {
        wanted.set(hash, () => deps.readSource(assetId, asset))
      }
    }
  }
  const out: SiteDerivativeInput[] = []
  let done = 0
  progress(done, wanted.size)
  for (const [assetHash, readSource] of wanted) {
    await deps.request([{ assetHash, readSource }])
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
    done += 1
    progress(done, wanted.size)
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
    const { meta, revision } = publishBook({}, book, nowMs)
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
    const { meta, revisions } = await freezeForExport(
      deps.book,
      deps.storage,
      deps.now(),
    )
    const derivatives = await collectSiteDerivatives(
      revisions,
      deps.derivatives,
      (done, total) => {
        deps.dispatch({
          type: 'progress',
          phase: 'prepare',
          percent: exportPercent('prepare', done, total),
        })
      },
    )
    const request: SiteExportRequest = {
      folder: deps.folder as unknown as SiteDirectoryHandle,
      input: { meta, revisions, derivatives },
    }
    const transfer = derivatives.map((d) => d.bytes.buffer as ArrayBuffer)
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
