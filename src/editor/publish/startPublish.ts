import { getDerivative, requestDerivatives } from '../../derivatives/pool'
import type {
  LibraryMeta,
  LibraryStorage,
  PublishedRevision,
} from '../../project'
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
import { getBookStoreSnapshot } from '../bookStore'
import {
  collectSiteDerivatives,
  freezeForExport,
  type SiteDerivativeDeps,
} from '../export/exportSiteRun'
import { loadSiteViewerBundle } from '../export/siteViewerBundle'
import { readSource } from '../export/startExportSite'
import { getOpenLibrary } from '../projectSession'
import { publishStore, type PublishEvent } from './publishStore'
import { publishPercent, type PublishFailure } from './publishText'

interface PublishFreeze {
  meta: LibraryMeta
  revisions: PublishedRevision[]
}

export interface PublishRunDeps {
  bookId: string
  loadHosting: () => Promise<HostingSummary | null>
  /** P1: `publishBook` now, or the failed run's revisions for Try again. */
  freeze: () => Promise<PublishFreeze>
  derivatives: SiteDerivativeDeps
  loadViewer: () => Promise<SiteViewerBundle>
  /** Posts the request; calls `onMessage` for each worker message. */
  runWorker: (
    request: PublishRequest,
    transfer: Transferable[],
    onMessage: (message: PublishMessage) => void,
  ) => void
  /** P12: ask before the tab closes; returns the release. */
  guardUnload: () => () => void
  dispatch: (event: PublishEvent) => boolean
}

/** P10: the site home, `publicBaseUrl + "/"`. */
export function siteHomeUrl(publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/`
}

function toFailure(message: Extract<PublishMessage, { failed: unknown }>) {
  const { code, ...rest } = message.failed
  const failure: PublishFailure = {
    code: code === 'render' ? 'build' : code,
    ...rest,
  }
  return failure
}

/**
 * One Publish: hosting summary, freeze, web derivatives, then build + upload
 * in the publish worker (which loads the credentials itself, P8). Every
 * outcome ends in `done` or `failed`; nothing runs when a publish is going.
 */
export async function runPublishBook(deps: PublishRunDeps): Promise<void> {
  if (!deps.dispatch({ type: 'start' })) {
    return
  }
  const release = deps.guardUnload()
  const fail = (code: PublishFailure['code']) =>
    deps.dispatch({
      type: 'failed',
      failure: { code, message: '', sent: 0, total: 0 },
    })
  try {
    const hosting = await deps.loadHosting()
    if (hosting === null) {
      fail('unconnected')
      return
    }
    const homeUrl = siteHomeUrl(hosting.publicBaseUrl)
    const frozen = await deps.freeze()
    const { revisions, derivatives } = await collectSiteDerivatives(
      frozen.revisions,
      deps.derivatives,
      (done, total) => {
        deps.dispatch({
          type: 'progress',
          percent: publishPercent('prepare', done, total),
        })
      },
    )
    const viewer = await deps.loadViewer()
    const request: PublishRequest = {
      input: { meta: frozen.meta, revisions, derivatives, viewer },
      bookId: deps.bookId,
    }
    const transfer = [...derivatives, ...viewer.files].map(
      (file) => file.bytes.buffer as ArrayBuffer,
    )
    await new Promise<void>((resolve) => {
      deps.runWorker(request, transfer, (message) => {
        if ('phase' in message) {
          deps.dispatch({
            type: 'progress',
            percent: publishPercent(message.phase, message.done, message.total),
          })
          return
        }
        if ('failed' in message) {
          deps.dispatch({ type: 'failed', failure: toFailure(message) })
        } else {
          const { bookUrl, ...summary } = message.done
          deps.dispatch({ type: 'done', summary, bookUrl, homeUrl })
        }
        resolve()
      })
    })
  } catch {
    fail('build')
  } finally {
    release()
  }
}

function runInWorker(
  request: PublishRequest,
  transfer: Transferable[],
  onMessage: (message: PublishMessage) => void,
): void {
  const worker = createPublishWorker()
  worker.onmessage = (event: MessageEvent<PublishMessage>) => {
    onMessage(event.data)
    if (!('phase' in event.data)) {
      worker.terminate()
    }
  }
  worker.onerror = () => {
    onMessage({
      failed: { code: 'other', message: '', sent: 0, total: 0 },
    })
    worker.terminate()
  }
  worker.postMessage(request, transfer)
}

function guardUnload(): () => void {
  const ask = (event: BeforeUnloadEvent) => {
    event.preventDefault()
  }
  window.addEventListener('beforeunload', ask)
  return () => {
    window.removeEventListener('beforeunload', ask)
  }
}

/** The last freeze, for Try again (no new `publishBook`, P4). */
let lastFreeze: PublishFreeze | null = null

/**
 * Publish the open book (and the other published ones). `retry`: the
 * revisions frozen by the last Publish, when this page still has them.
 */
export function startPublish(retry = false): void {
  const { book } = getBookStoreSnapshot()
  const storage: LibraryStorage | null = getOpenLibrary()?.storage ?? null
  // The freeze's first revision is the open book (`freezeForExport`).
  const kept =
    retry && lastFreeze?.revisions[0]?.book.id === book.id ? lastFreeze : null
  void runPublishBook({
    bookId: book.id,
    loadHosting: () => loadHostingSummary(),
    freeze:
      kept === null
        ? async () => {
            lastFreeze = await freezeForExport(book, storage, Date.now())
            return lastFreeze
          }
        : () => Promise.resolve(kept),
    derivatives: {
      request: requestDerivatives,
      get: getDerivative,
      readSource,
    },
    loadViewer: () =>
      loadSiteViewerBundle((url) => fetch(url), import.meta.env.BASE_URL),
    runWorker: runInWorker,
    guardUnload,
    dispatch: publishStore.dispatch,
  })
}
