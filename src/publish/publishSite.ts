/**
 * Publish: upload a hashed site tree to the user's R2 bucket against the
 * remote manifest of the last publish. Pure orchestration over an injected
 * `fetch` / clock / sleep; credentials only sign requests and never appear in
 * a result (messages go through `redact`).
 */

import type { CheckCode, R2Credentials } from './credentials'
import { classifyR2Failure, r2FailureMessage, type R2Failure } from './r2Errors'
import { r2Request, type R2RequestInput } from './r2Sign'
import {
  fileKind,
  planUpload,
  type PublishFile,
  type RemoteManifest,
  type UploadStep,
} from './uploadPlan'

export const PUBLISH_MANIFEST_KEY = '_photobooks/publish-manifest.json'
export const REQUEST_TIMEOUT_MS = 30_000
/** Waits before the 2nd and 3rd attempt; 3 attempts in total. */
const RETRY_WAITS_MS: readonly number[] = [1_000, 3_000]
const RETRY_AFTER_MAX_MS = 10_000
const PUT_CONCURRENCY = 4
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'
export const CACHE_NO_CACHE = 'no-cache'
export const CACHE_NO_STORE = 'no-store'

export interface PublishSiteFile extends PublishFile {
  bytes: Uint8Array
}

export interface PublishProgress {
  /** `upload`: bytes put; `finish`: deletes and the manifest, by request. */
  phase: 'upload' | 'finish'
  done: number
  total: number
}

export interface PublishSiteInput {
  files: readonly PublishSiteFile[]
  credentials: R2Credentials
  /** Site-root-relative page to link; `''` (default) is the site home. */
  bookPath?: string
  onProgress?: (progress: PublishProgress) => void
}

export interface PublishDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Resolves after `ms`, or early once `signal` aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  /** `navigator.onLine` by default. */
  isOnline?: () => boolean
}

export type PublishResult =
  | {
      ok: true
      uploaded: number
      bytes: number
      removed: number
      unchanged: number
      bookUrl: string
    }
  | {
      ok: false
      code: CheckCode
      status?: number
      /** Redacted. */
      message: string
      /** Files put before the run stopped, of `total` to put. */
      sent: number
      total: number
    }

const CONTENT_TYPES = new Map([
  ['html', 'text/html; charset=utf-8'],
  ['json', 'application/json'],
  ['css', 'text/css; charset=utf-8'],
  ['js', 'text/javascript; charset=utf-8'],
  ['mjs', 'text/javascript; charset=utf-8'],
  ['map', 'application/json'],
  ['txt', 'text/plain; charset=utf-8'],
  ['xml', 'application/xml'],
  ['svg', 'image/svg+xml'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['ico', 'image/x-icon'],
  ['woff2', 'font/woff2'],
  ['woff', 'font/woff'],
  ['webmanifest', 'application/manifest+json'],
])

export function contentTypeOf(key: string): string {
  const name = key.slice(key.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  const ext = dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
  return CONTENT_TYPES.get(ext) ?? 'application/octet-stream'
}

/** P6: content-hashed assets are immutable; pages, data and the rest revalidate. */
export function cacheControlOf(key: string): string {
  if (key === PUBLISH_MANIFEST_KEY) return CACHE_NO_STORE
  if (fileKind(key) !== 'asset') return CACHE_NO_CACHE
  const name = key.slice(key.lastIndexOf('/') + 1)
  return /[0-9a-f]{16}/.test(name) ? CACHE_IMMUTABLE : CACHE_NO_CACHE
}

/** A key the manifest may name: inside the bucket and outside `_photobooks/`. */
function isSiteKey(key: string): boolean {
  return (
    !key.startsWith('_photobooks/') &&
    key.split('/').every((segment) => !['', '.', '..'].includes(segment))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `{v: 1, files: {key: sha256}}`; anything malformed reads as empty. */
export function parseManifest(text: string): RemoteManifest {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return {}
  }
  if (!isRecord(data) || data.v !== 1 || !isRecord(data.files)) return {}
  return Object.fromEntries(
    Object.entries(data.files).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        /^[0-9a-f]{64}$/.test(entry[1]) &&
        isSiteKey(entry[0]),
    ),
  )
}

function manifestBytes(files: ReadonlyMap<string, string>): Uint8Array {
  const sorted = Object.fromEntries(
    [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
  return new TextEncoder().encode(JSON.stringify({ v: 1, files: sorted }))
}

class R2Error extends Error {
  constructor(readonly failure: R2Failure) {
    super(`R2 ${failure.code}`)
  }
}

type Attempt =
  | { response: Response }
  | { failure: R2Failure; transient: boolean; waitMs?: number }

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get('retry-after') ?? '')
  return response.status === 429 && Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, RETRY_AFTER_MAX_MS)
    : undefined
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/** Runs `task` over `items`, `limit` at a time in order; the first failure stops new tasks and is rethrown once all settle. */
async function inPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const errors: unknown[] = []
  const lane = async (): Promise<void> => {
    while (errors.length === 0 && next < items.length) {
      const item = items[next] as T
      next += 1
      try {
        await task(item)
      } catch (error) {
        errors.push(error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  if (errors.length > 0) throw errors[0]
}

/** Consecutive steps of one kind (plan order is assets → json → html). */
function kindGroups(steps: readonly UploadStep[]): UploadStep[][] {
  const groups: UploadStep[][] = []
  for (const step of steps) {
    const last = groups.at(-1)
    if (
      last?.[0] !== undefined &&
      fileKind(last[0].key) === fileKind(step.key)
    ) {
      last.push(step)
    } else {
      groups.push([step])
    }
  }
  return groups
}

/**
 * GET the manifest (404 → empty), put the new or changed files 4 at a time
 * with each kind group finished before the next, delete keys only the old
 * manifest has, then PUT the manifest. A failed run writes, best effort, the
 * manifest of what is on R2 now, so the next run sends only the rest.
 */
export async function publishSite(
  input: PublishSiteInput,
  deps: PublishDeps = {},
): Promise<PublishResult> {
  const { credentials } = input
  const doFetch = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? defaultSleep
  const isOnline = deps.isOnline ?? (() => navigator.onLine)

  const attempt = async (
    request: Omit<R2RequestInput, 'now'>,
    missingIsOk: boolean,
  ): Promise<Attempt> => {
    const signed = await r2Request(credentials, { ...request, now: now() })
    // Aborted only by the 30 s timeout: `aborted` means timed out.
    const timeout = new AbortController()
    const settled = new AbortController()
    void sleep(REQUEST_TIMEOUT_MS, settled.signal).then(() => {
      if (!settled.signal.aborted) timeout.abort()
    })
    try {
      const response = await doFetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        ...(request.body === undefined
          ? {}
          : { body: request.body as BodyInit }),
        cache: 'no-store',
        // A redirect would replay the signed request; never follow one.
        redirect: 'error',
        signal: timeout.signal,
      })
      if (response.ok) return { response }
      const body = await response.text().catch(() => '')
      const failure = classifyR2Failure({ status: response.status, body })
      if (missingIsOk && response.status === 404 && failure.code !== 'bucket') {
        return { response }
      }
      const waitMs = retryAfterMs(response)
      return {
        failure,
        transient: isTransientStatus(response.status),
        ...(waitMs === undefined ? {} : { waitMs }),
      }
    } catch {
      const timedOut = timeout.signal.aborted
      const online = isOnline()
      return {
        failure: classifyR2Failure({ timedOut, online }),
        transient: timedOut || online,
      }
    } finally {
      settled.abort()
    }
  }

  /** One request with P4 retries; throws `R2Error` on the final failure. */
  const send = async (
    request: Omit<R2RequestInput, 'now'>,
    missingIsOk = false,
  ): Promise<Response> => {
    for (let tries = 0; ; tries += 1) {
      const result = await attempt(request, missingIsOk)
      if ('response' in result) return result.response
      const wait = RETRY_WAITS_MS[tries]
      if (!result.transient || wait === undefined) {
        throw new R2Error(result.failure)
      }
      await sleep(result.waitMs ?? wait)
    }
  }

  const putManifest = (files: ReadonlyMap<string, string>) =>
    send({
      method: 'PUT',
      key: PUBLISH_MANIFEST_KEY,
      body: manifestBytes(files),
      contentType: contentTypeOf(PUBLISH_MANIFEST_KEY),
      cacheControl: CACHE_NO_STORE,
    })

  const bytesOf = new Map(input.files.map((file) => [file.key, file.bytes]))
  let live = new Map<string, string>()
  let puts: UploadStep[] = []
  let sent = 0
  let writePartial = false
  try {
    const got = await send({ method: 'GET', key: PUBLISH_MANIFEST_KEY }, true)
    const remote = got.status === 404 ? {} : parseManifest(await got.text())
    writePartial = true
    live = new Map(Object.entries(remote))
    const plan = planUpload(input.files, remote)
    puts = plan.filter((step) => step.op === 'put')
    const deletes = plan.filter((step) => step.op === 'delete')
    const totalBytes = puts.reduce(
      (sum, step) => sum + (bytesOf.get(step.key)?.byteLength ?? 0),
      0,
    )
    let sentBytes = 0
    input.onProgress?.({ phase: 'upload', done: 0, total: totalBytes })
    for (const group of kindGroups(puts)) {
      await inPool(group, PUT_CONCURRENCY, async (step) => {
        const body = bytesOf.get(step.key) ?? new Uint8Array()
        await send({
          method: 'PUT',
          key: step.key,
          body,
          contentType: contentTypeOf(step.key),
          cacheControl: cacheControlOf(step.key),
        })
        if (step.op === 'put') live.set(step.key, step.sha256)
        sent += 1
        sentBytes += body.byteLength
        input.onProgress?.({
          phase: 'upload',
          done: sentBytes,
          total: totalBytes,
        })
      })
    }
    const finishTotal = deletes.length + 1
    let finished = 0
    input.onProgress?.({ phase: 'finish', done: 0, total: finishTotal })
    await inPool(deletes, PUT_CONCURRENCY, async (step) => {
      await send({ method: 'DELETE', key: step.key }, true)
      live.delete(step.key)
      finished += 1
      input.onProgress?.({
        phase: 'finish',
        done: finished,
        total: finishTotal,
      })
    })
    // The manifest itself failing leaves the old one: no second write.
    writePartial = false
    await putManifest(live)
    input.onProgress?.({
      phase: 'finish',
      done: finishTotal,
      total: finishTotal,
    })
    return {
      ok: true,
      uploaded: puts.length,
      bytes: totalBytes,
      removed: deletes.length,
      unchanged: input.files.length - puts.length,
      bookUrl: new URL(
        input.bookPath ?? '',
        credentials.publicBaseUrl.replace(/\/*$/, '/'),
      ).href,
    }
  } catch (error) {
    if (writePartial) await putManifest(live).catch(() => undefined)
    const failure: R2Failure =
      error instanceof R2Error ? error.failure : { code: 'other' }
    return {
      ok: false,
      code: failure.code,
      ...(failure.status === undefined ? {} : { status: failure.status }),
      message: r2FailureMessage(
        failure,
        credentials,
        'recheck',
        REQUEST_TIMEOUT_MS,
      ),
      sent,
      total: puts.length,
    }
  }
}
