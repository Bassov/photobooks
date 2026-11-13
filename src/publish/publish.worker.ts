/**
 * Publish worker: builds and hashes the site, reads the R2 credentials from
 * IndexedDB itself and uploads. The credentials never cross `postMessage`
 * (P8): the request carries none, and the page gets only phase progress and
 * one redacted result.
 */

import { sha256HexSync } from '../assets/sha256Sync'
import { buildSiteTree } from '../site/export/buildSiteTree'
import type { SiteExportInput } from '../site/export/types'
import { createCredentialStore, type CheckCode } from './credentials'
import { publishSite, type PublishDeps } from './publishSite'
import { hashSiteFiles } from './uploadPlan'

/** Progress posts are at least this far apart. */
export const PUBLISH_PROGRESS_MS = 250

type PublishPhase = 'render' | 'upload' | 'finish'

export interface PublishRequest {
  /** Without `renderer`: functions are not cloneable, the default one is used. */
  input: Omit<SiteExportInput, 'renderer'>
  /** The book whose page the result links; absent → the site home. */
  bookId?: string
}

export type PublishFailureCode = CheckCode | 'unconnected' | 'render'

export type PublishMessage =
  | { phase: PublishPhase; done: number; total: number }
  | {
      done: {
        uploaded: number
        bytes: number
        removed: number
        unchanged: number
        bookUrl: string
      }
    }
  | {
      failed: {
        code: PublishFailureCode
        status?: number
        /** Redacted. */
        message: string
        sent: number
        total: number
      }
    }

export interface PublishWorkerDeps {
  /** Progress clock in ms (`performance.now` in the worker). */
  clock: () => number
  indexedDB?: IDBFactory
  publish?: PublishDeps
}

/** P9: failures that mean the stored hosting no longer works. */
const STATUS_CODES: readonly CheckCode[] = ['key', 'denied', 'bucket']

const failed = (code: PublishFailureCode, message: string): PublishMessage => ({
  failed: { code, message, sent: 0, total: 0 },
})

/** Site-root path of `bookId`'s page when the tree has it, else the home. */
function bookPathIn(paths: ReadonlySet<string>, bookId?: string): string {
  if (bookId === undefined) return ''
  const dir = `books/${sha256HexSync(bookId).slice(0, 16)}/`
  return paths.has(`${dir}index.html`) ? dir : ''
}

/**
 * Builds, hashes and publishes the site; writes the hosting status on a
 * success or a `key` / `denied` / `bucket` failure. Progress closer than
 * `PUBLISH_PROGRESS_MS` to the previous post is dropped; exactly one final
 * `done` / `failed` message follows.
 */
export async function runPublish(
  request: PublishRequest,
  post: (message: PublishMessage) => void,
  deps: PublishWorkerDeps,
): Promise<void> {
  let postedAt = Number.NEGATIVE_INFINITY
  const progress = (phase: PublishPhase, done: number, total: number) => {
    const at = deps.clock()
    if (at - postedAt < PUBLISH_PROGRESS_MS) return
    postedAt = at
    post({ phase, done, total })
  }
  const store = createCredentialStore(deps.indexedDB)
  let tree
  let hashes
  try {
    progress('render', 0, 1)
    tree = await buildSiteTree(request.input)
    hashes = await hashSiteFiles(tree.files)
  } catch {
    post(failed('render', "Couldn't build the site. Try again."))
    return
  }
  try {
    const credentials = await store.load()
    if (credentials === undefined) {
      post(
        failed('unconnected', 'Connect hosting in Settings → Hosting first.'),
      )
      return
    }
    const bytes = new Map(tree.files.map((file) => [file.path, file.bytes]))
    const result = await publishSite(
      {
        files: hashes.map((file) => ({
          ...file,
          bytes: bytes.get(file.key) ?? new Uint8Array(),
        })),
        credentials,
        bookPath: bookPathIn(new Set(bytes.keys()), request.bookId),
        onProgress: (step) => {
          progress(step.phase, step.done, step.total)
        },
      },
      deps.publish,
    )
    const checkedAtMs = (deps.publish?.now ?? (() => new Date()))().getTime()
    if (result.ok) {
      await store.saveStatus({ checkedAtMs, ok: true }).catch(() => undefined)
      const { uploaded, bytes: sentBytes, removed, unchanged, bookUrl } = result
      post({
        done: { uploaded, bytes: sentBytes, removed, unchanged, bookUrl },
      })
      return
    }
    if (STATUS_CODES.includes(result.code)) {
      await store
        .saveStatus({
          checkedAtMs,
          ok: false,
          code: result.code,
          message: result.message,
        })
        .catch(() => undefined)
    }
    const { code, status, message, sent, total } = result
    post({
      failed: {
        code,
        ...(status === undefined ? {} : { status }),
        message,
        sent,
        total,
      },
    })
  } catch {
    post(failed('other', 'Something went wrong. Try again.'))
  }
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PublishRequest>) => void) | null
  postMessage: (message: PublishMessage) => void
}

workerScope.onmessage = (event: MessageEvent<PublishRequest>) => {
  void runPublish(
    event.data,
    (message) => {
      workerScope.postMessage(message)
    },
    { clock: () => performance.now() },
  )
}
