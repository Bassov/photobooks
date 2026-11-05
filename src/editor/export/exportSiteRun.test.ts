import { describe, expect, it, vi } from 'vitest'
import type { Book } from '../../core'
import { makeBook, makeBookWithAsset } from '../../core/testing/fixtures'
import {
  createMemoryLibraryStorage,
  publishBook,
  type PublishedRevision,
} from '../../project'
import type { SiteExportMessage } from '../../site/export/site-export.worker'
import {
  collectSiteDerivatives,
  freezeForExport,
  otherPublishedTitles,
  runExportSite,
  type ExportSiteRunDeps,
  type SiteDerivativeDeps,
} from './exportSiteRun'
import {
  EXPORT_SITE_IDLE,
  reduceExportSite,
  type ExportSiteEvent,
  type ExportSiteState,
} from './exportSiteStore'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function bookWithHash(id: string, hash: string | undefined, title = id): Book {
  const book = makeBookWithAsset(`${id}-photo`)
  return {
    ...book,
    id,
    title,
    assets: {
      [`${id}-photo`]: hash === undefined ? {} : { contentHash: hash },
    },
  }
}

/** A tiny VP8X WebP header: `width` × `height`. */
function webp(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(30)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  bytes.set(new TextEncoder().encode('WEBPVP8X'), 8)
  const w = width - 1
  const h = height - 1
  bytes.set([w & 0xff, (w >> 8) & 0xff, w >> 16], 24)
  bytes.set([h & 0xff, (h >> 8) & 0xff, h >> 16], 27)
  return bytes.buffer
}

function derivativeDeps(
  cached: (hash: string, preset: string) => ArrayBuffer | undefined,
): SiteDerivativeDeps & { request: ReturnType<typeof vi.fn> } {
  return {
    request: vi.fn(() => Promise.resolve([])),
    get: (hash, preset) => {
      const bytes = cached(hash, preset)
      return Promise.resolve(
        bytes === undefined ? undefined : { bytes, mimeType: 'image/webp' },
      )
    },
    readSource: (assetId) => Promise.resolve(new Blob([assetId])),
  }
}

describe('collectSiteDerivatives', () => {
  it('asks the pool once per photo and keeps readable presets', async () => {
    const first = publishBook({}, bookWithHash('one', HASH_A), 1).revision
    const again = publishBook({}, bookWithHash('two', HASH_A), 2).revision
    const other = publishBook({}, bookWithHash('three', HASH_B), 3).revision
    const bare = publishBook({}, bookWithHash('four', undefined), 4).revision
    const deps = derivativeDeps((hash, preset) =>
      hash === HASH_A && preset === 'site-thumb'
        ? webp(480, 320)
        : hash === HASH_B && preset === 'site-display'
          ? new ArrayBuffer(4)
          : undefined,
    )
    const progress = vi.fn()

    const out = await collectSiteDerivatives(
      [first, again, other, bare],
      deps,
      progress,
    )

    expect(out).toEqual([
      {
        assetHash: HASH_A,
        presetId: 'site-thumb',
        bytes: new Uint8Array(webp(480, 320)),
        width: 480,
        height: 320,
      },
    ])
    expect(deps.request).toHaveBeenCalledTimes(2)
    expect(progress.mock.calls).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
    const [[requests]] = deps.request.mock.calls as [
      [{ assetHash: string; readSource: () => Promise<Blob> }[]],
    ]
    expect(requests[0]?.assetHash).toBe(HASH_A)
    expect(await requests[0]?.readSource().then((blob) => blob.text())).toBe(
      'one-photo',
    )
  })
})

describe('freezeForExport', () => {
  it('keeps the session book in memory', async () => {
    const book = makeBook({ id: 'open' })

    const frozen = await freezeForExport(book, null, 5)

    expect(frozen.meta).toEqual({ books: { open: { status: 'published' } } })
    expect(frozen.revisions).toEqual([
      { bookId: 'open', publishedAtMs: 5, book },
    ])
  })

  it('saves the open book and adds the other published books, not drafts', async () => {
    const storage = createMemoryLibraryStorage()
    const open = makeBook({ id: 'open', title: 'Lake' })
    const older = makeBook({ id: 'older', title: 'Fog' })
    const newer = makeBook({ id: 'newer', title: 'Summer' })
    const draft = makeBook({ id: 'draft', title: 'Draft' })
    for (const book of [open, older, newer, draft]) {
      await storage.createBook(book)
    }
    let meta = {}
    for (const [book, at] of [
      [older, 1],
      [newer, 2],
    ] as const) {
      const published = publishBook(meta, book, at)
      meta = published.meta
      await storage.savePublished(published.revision)
    }
    await storage.updateLibrary(meta)

    const frozen = await freezeForExport(open, storage, 9)

    expect(frozen.revisions.map((r) => r.bookId)).toEqual([
      'open',
      'newer',
      'older',
    ])
    expect(await storage.loadPublished('open')).toMatchObject({
      ok: true,
      value: { publishedAtMs: 9 },
    })
    expect((await storage.getLibrary()).ok && frozen.meta.books).toEqual({
      older: { status: 'published' },
      newer: { status: 'published' },
      open: { status: 'published' },
    })
    expect(await otherPublishedTitles(storage, 'open')).toEqual([
      'Summer',
      'Fog',
    ])
    expect(await otherPublishedTitles(null, 'open')).toEqual([])
  })

  it('throws when the library cannot be read or written', async () => {
    const storage = createMemoryLibraryStorage()
    const book = makeBook({ id: 'open' })

    await expect(freezeForExport(book, storage, 1)).rejects.toThrow(
      'published.json not saved',
    )
    await storage.createBook(book)
    storage.setPermissionRequired(true)
    await expect(freezeForExport(book, storage, 1)).rejects.toThrow(
      'Library unavailable',
    )
    expect(await otherPublishedTitles(storage, 'open')).toEqual([])
  })
})

function runDeps(
  messages: SiteExportMessage[],
  overrides: Partial<ExportSiteRunDeps> = {},
) {
  let state: ExportSiteState = EXPORT_SITE_IDLE
  const events: ExportSiteEvent[] = []
  const posted: unknown[] = []
  const deps: ExportSiteRunDeps = {
    book: bookWithHash('open', HASH_A, 'Lake'),
    storage: null,
    folder: { name: 'Site' } as FileSystemDirectoryHandle,
    now: () => 7,
    requestWrite: () => Promise.resolve(true),
    derivatives: derivativeDeps(() => webp(2, 2)),
    runWorker: (request, transfer, onMessage) => {
      posted.push({ request, transfer })
      for (const message of messages) {
        onMessage(message)
      }
    },
    dispatch: (event) => {
      const next = reduceExportSite(state, event)
      events.push(event)
      const changed = next !== state
      state = next
      return changed
    },
    ...overrides,
  }
  return { deps, events, posted, state: () => state }
}

describe('runExportSite', () => {
  it('runs prepare, render and write, then ends done', async () => {
    const run = runDeps([
      { phase: 'render', done: 0, total: 1 },
      { phase: 'write', done: 2, total: 4 },
      { done: { books: 1, files: 9, bytes: 99 } },
    ])

    await runExportSite(run.deps)

    expect(run.events.map((e) => e.type)).toEqual([
      'start',
      'progress',
      'progress',
      'progress',
      'progress',
      'done',
    ])
    expect(run.events.slice(1, 5)).toMatchObject([
      { phase: 'prepare', percent: 0 },
      { phase: 'prepare', percent: 30 },
      { phase: 'render', percent: 30 },
      { phase: 'write', percent: 90 },
    ])
    expect(run.state()).toEqual({
      kind: 'done',
      summary: { books: 1, files: 9, bytes: 99 },
      folder: 'Site',
    })
    const [post] = run.posted as [
      {
        request: { input: { revisions: PublishedRevision[] } }
        transfer: ArrayBuffer[]
      },
    ]
    expect(post.request.input.revisions.map((r) => r.publishedAtMs)).toEqual([
      7,
    ])
    expect(post.transfer).toHaveLength(4)
  })

  it('passes a worker failure through', async () => {
    const run = runDeps([{ failed: { code: 'not-our-export' } }])

    await runExportSite(run.deps)

    expect(run.state()).toEqual({
      kind: 'failed',
      code: 'not-our-export',
      folder: 'Site',
    })
  })

  it('fails with permission when write access is refused', async () => {
    const runWorker = vi.fn()
    const run = runDeps([], {
      requestWrite: () => Promise.resolve(false),
      runWorker,
    })

    await runExportSite(run.deps)

    expect(run.state()).toMatchObject({ kind: 'failed', code: 'permission' })
    expect(runWorker).not.toHaveBeenCalled()
  })

  it('fails as unknown when freezing throws', async () => {
    const storage = createMemoryLibraryStorage()
    const run = runDeps([], { storage })

    await runExportSite(run.deps)

    expect(run.state()).toMatchObject({ kind: 'failed', code: 'unknown' })
  })

  it('does nothing while another export runs', async () => {
    const requestWrite = vi.fn(() => Promise.resolve(true))
    const run = runDeps([], { requestWrite, dispatch: () => false })

    await runExportSite(run.deps)

    expect(requestWrite).not.toHaveBeenCalled()
  })
})
