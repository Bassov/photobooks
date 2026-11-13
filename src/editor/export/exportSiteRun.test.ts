import { describe, expect, it, vi } from 'vitest'
import type { Book } from '../../core'
import { makeBook, makeBookWithAsset } from '../../core/testing/fixtures'
import {
  createMemoryLibraryStorage,
  publishBook,
  type LibraryStorage,
  type PublishedRevision,
} from '../../project'
import { sha256Hex } from '../../lib/sha256Hex'
import type { SiteExportMessage } from '../../site/export/site-export.worker'
import type { SiteViewerBundle } from '../../site/export/types'
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
const HASH_C = 'c'.repeat(64)

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
    const one = bookWithHash('one', HASH_A)
    // A gallery photo placed nowhere is not on the site.
    const loose = {
      ...one,
      assets: { ...one.assets, loose: { contentHash: HASH_C } },
    }
    const first = publishBook({}, loose, 1).revision
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

    expect(out.derivatives).toEqual([
      {
        assetHash: HASH_A,
        presetId: 'site-thumb',
        bytes: new Uint8Array(webp(480, 320)),
        width: 480,
        height: 320,
      },
    ])
    expect(deps.request).toHaveBeenCalledTimes(3)
    expect(progress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ])
    const requests = (
      deps.request.mock.calls as [
        { assetHash: string; readSource: () => Promise<Blob> }[],
      ][]
    ).map(([[request]]) => request)
    expect(requests[0]?.assetHash).toBe(HASH_A)
    expect(await requests[0]?.readSource().then((blob) => blob.text())).toBe(
      'one-photo',
    )
    expect(out.revisions.slice(0, 3)).toEqual([first, again, other])
  })

  it('hashes a photo without contentHash and writes the hash into its revision', async () => {
    const bare = publishBook({}, bookWithHash('four', undefined), 4).revision
    const twin = publishBook({}, bookWithHash('four', undefined), 5).revision
    const deps = derivativeDeps(() => undefined)
    const hash = await sha256Hex(new TextEncoder().encode('four-photo').buffer)

    const out = await collectSiteDerivatives([bare, twin], deps, vi.fn())

    const [[[request]]] = deps.request.mock.calls as [
      [{ assetHash: string; readSource: () => Promise<Blob> }[]],
    ]
    expect(deps.request).toHaveBeenCalledTimes(1)
    expect(request?.assetHash).toBe(hash)
    expect(await request?.readSource().then((blob) => blob.text())).toBe(
      'four-photo',
    )
    expect(
      out.revisions.map((r) => r.book.assets['four-photo']?.contentHash),
    ).toEqual([hash, hash])
    expect(bare.book.assets['four-photo']?.contentHash).toBeUndefined()
  })

  it('leaves out a photo whose source cannot be read for hashing', async () => {
    const bare = publishBook({}, bookWithHash('four', undefined), 4).revision
    const deps = {
      ...derivativeDeps(() => undefined),
      readSource: () => Promise.reject(new Error('gone')),
    }
    const progress = vi.fn()

    const out = await collectSiteDerivatives([bare], deps, progress)

    expect(deps.request).not.toHaveBeenCalled()
    expect(out).toEqual({ revisions: [bare], derivatives: [] })
    expect(progress.mock.calls).toEqual([
      [0, 1],
      [1, 1],
    ])
  })

  it('asks the pool once for two unhashed photos with the same bytes', async () => {
    const book = bookWithHash('one', undefined)
    const both = {
      ...book,
      assets: { 'one-photo': {}, copy: {} },
      spreads: book.spreads.map((spread) => ({
        ...spread,
        frames: [
          ...spread.frames,
          ...spread.frames.map((f) => ({ ...f, id: 'f2', assetId: 'copy' })),
        ],
      })),
    }
    const deps = {
      ...derivativeDeps(() => undefined),
      readSource: () => Promise.resolve(new Blob(['same'])),
    }

    const out = await collectSiteDerivatives(
      [publishBook({}, both, 1).revision],
      deps,
      vi.fn(),
    )

    expect(deps.request).toHaveBeenCalledTimes(1)
    const assets = out.revisions[0]?.book.assets
    expect(assets?.copy?.contentHash).toBe(assets?.['one-photo']?.contentHash)
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
    // Published in library.json but its published.json is gone: skipped.
    await storage.updateLibrary({
      ...meta,
      books: {
        ...(meta as { books: object }).books,
        lost: { status: 'published' },
      },
    })

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
    expect(await storage.getLibrary()).toMatchObject({
      ok: true,
      value: { books: { open: { status: 'published' } } },
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

  it('throws when library.json cannot be written', async () => {
    const storage = createMemoryLibraryStorage()
    const book = makeBook({ id: 'open' })
    await storage.createBook(book)
    const readOnly: LibraryStorage = {
      ...storage,
      updateLibrary: () =>
        Promise.resolve({ ok: false, code: 'locked-elsewhere' }),
    }

    await expect(freezeForExport(book, readOnly, 1)).rejects.toThrow(
      'library.json not saved: locked-elsewhere',
    )
  })
})

function viewerBundle(): SiteViewerBundle {
  return {
    entry: 'assets/site.js',
    css: ['assets/site.css'],
    files: [
      { path: 'assets/site.css', bytes: new Uint8Array(5) },
      { path: 'assets/site.js', bytes: new Uint8Array(7) },
    ],
  }
}

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
    loadViewer: () => Promise.resolve(viewerBundle()),
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
        request: {
          input: { revisions: PublishedRevision[]; viewer: SiteViewerBundle }
        }
        transfer: ArrayBuffer[]
      },
    ]
    expect(post.request.input.revisions.map((r) => r.publishedAtMs)).toEqual([
      7,
    ])
    expect(post.request.input.viewer).toEqual(viewerBundle())
    expect(post.transfer.map((b) => b.byteLength)).toEqual([
      30, 30, 30, 30, 5, 7,
    ])
  })

  it("sends the library's site settings without a url (S7)", async () => {
    const storage = createMemoryLibraryStorage()
    const book = bookWithHash('open', HASH_A, 'Lake')
    await storage.createBook(book)
    await storage.updateLibrary({
      site: { title: 'Alps', author: 'Ann' },
    })
    const run = runDeps([{ done: { books: 1, files: 1, bytes: 1 } }], {
      book,
      storage,
    })

    await runExportSite(run.deps)

    const [post] = run.posted as [{ request: { input: { site: unknown } } }]
    expect(post.request.input.site).toStrictEqual({
      title: 'Alps',
      author: 'Ann',
    })
  })

  it('sends the title-only default without site settings', async () => {
    const run = runDeps([{ done: { books: 1, files: 1, bytes: 1 } }])

    await runExportSite(run.deps)

    const [post] = run.posted as [{ request: { input: { site: unknown } } }]
    expect(post.request.input.site).toStrictEqual({ title: 'Photobooks' })
  })

  it('fails as unknown without starting the worker when the viewer cannot load', async () => {
    const runWorker = vi.fn()
    const run = runDeps([], {
      loadViewer: () => Promise.reject(new Error('HTTP 404')),
      runWorker,
    })

    await runExportSite(run.deps)

    expect(run.state()).toMatchObject({ kind: 'failed', code: 'unknown' })
    expect(runWorker).not.toHaveBeenCalled()
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
