import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook } from '../../core/testing/fixtures'
import type { LibraryMeta, PublishedRevision } from '../../project'
import { createPublishWorker } from '../../publish/createPublishWorker'
import {
  loadHostingSummary,
  type HostingSummary,
} from '../../publish/credentials'
import type {
  PublishMessage,
  PublishRequest,
} from '../../publish/publish.worker'
import type { SiteViewerBundle } from '../../site/export/types'
import { resetBookStore } from '../bookStore'
import {
  collectSiteDerivatives,
  freezeForExport,
} from '../export/exportSiteRun'
import { loadSiteViewerBundle } from '../export/siteViewerBundle'
import { publishStore, type PublishEvent } from './publishStore'
import {
  runPublishBook,
  siteHomeUrl,
  startPublish,
  type PublishRunDeps,
} from './startPublish'

vi.mock('../../publish/createPublishWorker', () => ({
  createPublishWorker: vi.fn(),
}))
vi.mock('../../publish/credentials', () => ({
  loadHostingSummary: vi.fn(),
}))
vi.mock('../export/siteViewerBundle', () => ({
  loadSiteViewerBundle: vi.fn(),
}))
vi.mock('../export/exportSiteRun', () => ({
  collectSiteDerivatives: vi.fn(),
  freezeForExport: vi.fn(),
}))

const book = makeBook({ id: 'b1', title: 'Lake' })
const meta = { books: {} } as unknown as LibraryMeta
const revision = { book, publishedAtMs: 1 } as unknown as PublishedRevision
const viewer: SiteViewerBundle = {
  files: [{ path: 'viewer.js', bytes: new Uint8Array([1, 2]) }],
} as unknown as SiteViewerBundle
const derivative = { path: 'assets/a.avif', bytes: new Uint8Array([3]) }
const hosting: HostingSummary = {
  accountId: 'acc',
  bucket: 'my-books',
  accessKeyTail: '9f2c',
  publicBaseUrl: 'https://books.example.com',
  status: null,
}
const doneMessage: PublishMessage = {
  done: {
    uploaded: 2,
    bytes: 900,
    removed: 1,
    unchanged: 5,
    bookUrl: 'https://books.example.com/books/abc/',
  },
}

class FakeWorker {
  onmessage: ((event: MessageEvent<PublishMessage>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  send(data: PublishMessage): void {
    this.onmessage?.({ data } as MessageEvent<PublishMessage>)
  }
}

beforeEach(() => {
  vi.mocked(collectSiteDerivatives).mockImplementation(
    (revisions, _deps, onProgress) => {
      onProgress(1, 2)
      return Promise.resolve({
        revisions,
        derivatives: [derivative],
      } as unknown as Awaited<ReturnType<typeof collectSiteDerivatives>>)
    },
  )
  vi.mocked(freezeForExport).mockResolvedValue({ meta, revisions: [revision] })
  vi.mocked(loadSiteViewerBundle).mockResolvedValue(viewer)
  vi.mocked(loadHostingSummary).mockResolvedValue(hosting)
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  publishStore.dispatch({ type: 'seen' })
  publishStore.dispatch({ type: 'expire' })
  resetBookStore()
  vi.clearAllMocks()
})

/** Fake deps; the worker answers with `answer` (none: it never answers). */
function fakeDeps(answer?: PublishMessage[]) {
  const events: PublishEvent[] = []
  const release = vi.fn()
  const posted: { request: PublishRequest; transfer: Transferable[] }[] = []
  const deps: PublishRunDeps = {
    bookId: 'b1',
    loadHosting: vi.fn(() => Promise.resolve(hosting)),
    freeze: vi.fn(() => Promise.resolve({ meta, revisions: [revision] })),
    derivatives: {} as PublishRunDeps['derivatives'],
    loadViewer: () => Promise.resolve(viewer),
    runWorker: (request, transfer, onMessage) => {
      posted.push({ request, transfer })
      for (const message of answer ?? []) onMessage(message)
    },
    guardUnload: vi.fn(() => release),
    dispatch: (event) => {
      events.push(event)
      return true
    },
  }
  return { deps, events, release, posted }
}

describe('siteHomeUrl', () => {
  it('is the base with one trailing slash', () => {
    expect(siteHomeUrl('https://books.example.com')).toBe(
      'https://books.example.com/',
    )
    expect(siteHomeUrl('https://x.dev/site//')).toBe('https://x.dev/site/')
  })
})

describe('runPublishBook', () => {
  it('without hosting fails as unconnected and freezes nothing', async () => {
    const { deps, events, release } = fakeDeps()
    vi.mocked(deps.loadHosting).mockResolvedValue(null)

    await runPublishBook(deps)

    expect(events).toEqual([
      { type: 'start' },
      {
        type: 'failed',
        failure: { code: 'unconnected', message: '', sent: 0, total: 0 },
      },
    ])
    expect(deps.freeze).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('posts the frozen site to the worker and ends in done with the home URL', async () => {
    const { deps, events, release, posted } = fakeDeps([
      { phase: 'upload', done: 50, total: 100 },
      doneMessage,
    ])

    await runPublishBook(deps)

    expect(posted).toHaveLength(1)
    expect(posted[0]?.request).toEqual({
      input: {
        meta,
        revisions: [revision],
        derivatives: [derivative],
        viewer,
      },
      bookId: 'b1',
    })
    expect(posted[0]?.transfer).toEqual([
      derivative.bytes.buffer,
      viewer.files[0]?.bytes.buffer,
    ])
    expect(events).toEqual([
      { type: 'start' },
      { type: 'progress', percent: 20 },
      { type: 'progress', percent: 72 },
      {
        type: 'done',
        summary: { uploaded: 2, bytes: 900, removed: 1, unchanged: 5 },
        bookUrl: 'https://books.example.com/books/abc/',
        homeUrl: 'https://books.example.com/',
      },
    ])
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('passes a failure on and names a render failure build', async () => {
    const other = fakeDeps([
      {
        failed: {
          code: 'other',
          status: 503,
          message: 'Cloudflare answered 503 SlowDown. Check the values.',
          sent: 3,
          total: 9,
        },
      },
    ])
    await runPublishBook(other.deps)
    expect(other.events.at(-1)).toEqual({
      type: 'failed',
      failure: {
        code: 'other',
        status: 503,
        message: 'Cloudflare answered 503 SlowDown. Check the values.',
        sent: 3,
        total: 9,
      },
    })

    const render = fakeDeps([
      { failed: { code: 'render', message: 'x', sent: 0, total: 0 } },
    ])
    await runPublishBook(render.deps)
    expect(render.events.at(-1)).toEqual({
      type: 'failed',
      failure: { code: 'build', message: 'x', sent: 0, total: 0 },
    })
  })

  it('fails as build when the freeze throws, and releases the guard', async () => {
    const { deps, events, release } = fakeDeps()
    vi.mocked(deps.freeze).mockRejectedValue(new Error('library.json'))

    await runPublishBook(deps)

    expect(events.at(-1)).toEqual({
      type: 'failed',
      failure: { code: 'build', message: '', sent: 0, total: 0 },
    })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('does nothing while another publish runs', async () => {
    const { deps } = fakeDeps()
    deps.dispatch = vi.fn(() => false)

    await runPublishBook(deps)

    expect(deps.guardUnload).not.toHaveBeenCalled()
    expect(deps.loadHosting).not.toHaveBeenCalled()
  })
})

function nextWorker(): FakeWorker {
  const worker = new FakeWorker()
  vi.mocked(createPublishWorker).mockReturnValueOnce(
    worker as unknown as Worker,
  )
  return worker
}

/** `beforeunload` is cancelled (the browser asks) right now. */
function unloadAsks(): boolean {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('startPublish', () => {
  it('publishes the open book through the publish worker, guarding unload', async () => {
    const worker = nextWorker()

    startPublish()
    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledTimes(1)
    })

    expect(freezeForExport).toHaveBeenCalledWith(book, null, expect.any(Number))
    expect(loadSiteViewerBundle).toHaveBeenCalledWith(
      expect.any(Function),
      import.meta.env.BASE_URL,
    )
    expect(unloadAsks()).toBe(true)
    worker.send({ phase: 'render', done: 0, total: 1 })
    expect(worker.terminate).not.toHaveBeenCalled()
    worker.send(doneMessage)
    await vi.waitFor(() => {
      expect(publishStore.getSnapshot().kind).toBe('done')
    })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(unloadAsks()).toBe(false)
  })

  it('Try again reuses the failed run’s freeze for the same book', async () => {
    const failedRun = nextWorker()
    startPublish()
    await vi.waitFor(() => {
      expect(failedRun.postMessage).toHaveBeenCalled()
    })
    failedRun.onerror?.()
    await vi.waitFor(() => {
      expect(publishStore.getSnapshot()).toEqual({
        kind: 'failed',
        failure: { code: 'other', message: '', sent: 0, total: 0 },
      })
    })
    expect(failedRun.terminate).toHaveBeenCalledTimes(1)
    publishStore.dispatch({ type: 'seen' })

    const retry = nextWorker()
    startPublish(true)
    await vi.waitFor(() => {
      expect(retry.postMessage).toHaveBeenCalled()
    })
    expect(freezeForExport).toHaveBeenCalledTimes(1)
    retry.send(doneMessage)
    await vi.waitFor(() => {
      expect(publishStore.getSnapshot().kind).toBe('done')
    })
  })

  it('freezes again when the open book is another one', async () => {
    const first = nextWorker()
    startPublish()
    await vi.waitFor(() => {
      expect(first.postMessage).toHaveBeenCalled()
    })
    first.send({ failed: { code: 'timeout', message: '', sent: 1, total: 2 } })
    await vi.waitFor(() => {
      expect(publishStore.getSnapshot().kind).toBe('failed')
    })
    publishStore.dispatch({ type: 'seen' })
    resetBookStore({
      book: makeBook({ id: 'b2', title: 'Fog' }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const second = nextWorker()
    startPublish(true)
    await vi.waitFor(() => {
      expect(second.postMessage).toHaveBeenCalled()
    })
    expect(freezeForExport).toHaveBeenCalledTimes(2)
    second.send(doneMessage)
  })
})
