import { buildSiteTree, publishedRevisions } from './buildSiteTree'
import type { SiteExportInput } from './types'
import {
  siteExportErrorCode,
  writeSiteTree,
  type SiteDirectoryHandle,
  type SiteExportErrorCode,
} from './writeSiteTree'

/** Progress posts are at least this far apart. */
export const SITE_EXPORT_PROGRESS_MS = 250

type SiteExportPhase = 'render' | 'write'

export interface SiteExportRequest {
  /** The picked folder; the site goes into its `dist/`. */
  folder: SiteDirectoryHandle
  /** Without `renderer`: functions are not cloneable, the default one is used. */
  input: Omit<SiteExportInput, 'renderer'>
}

export type SiteExportMessage =
  | { phase: SiteExportPhase; done: number; total: number }
  | { done: { books: number; files: number; bytes: number } }
  | { failed: { code: SiteExportErrorCode } }

/**
 * Builds the site and writes it into `folder/dist/`. Progress closer than
 * `SITE_EXPORT_PROGRESS_MS` to the previous post is dropped; exactly one
 * final `done` / `failed` message follows.
 */
export async function runSiteExport(
  request: SiteExportRequest,
  post: (message: SiteExportMessage) => void,
  now: () => number,
): Promise<void> {
  let postedAt = Number.NEGATIVE_INFINITY
  const progress = (phase: SiteExportPhase, done: number, total: number) => {
    const at = now()
    if (at - postedAt < SITE_EXPORT_PROGRESS_MS) return
    postedAt = at
    post({ phase, done, total })
  }
  try {
    progress('render', 0, 1)
    const tree = await buildSiteTree(request.input)
    const result = await writeSiteTree(request.folder, tree, (done, total) => {
      progress('write', done, total)
    })
    post(
      result.ok
        ? {
            done: {
              books: publishedRevisions(request.input).length,
              files: result.files,
              bytes: result.bytes,
            },
          }
        : { failed: { code: result.code } },
    )
  } catch (error) {
    post({ failed: { code: siteExportErrorCode(error) } })
  }
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<SiteExportRequest>) => void) | null
  postMessage: (message: SiteExportMessage) => void
}

workerScope.onmessage = (event: MessageEvent<SiteExportRequest>) => {
  void runSiteExport(
    event.data,
    (message) => {
      workerScope.postMessage(message)
    },
    () => performance.now(),
  )
}
