/**
 * Publish: upload a hashed site tree to the user's R2 bucket against the
 * remote manifest of the last publish. Pure orchestration over an injected
 * `fetch` / clock / sleep; credentials only sign requests and never appear in
 * a result (messages go through `redact`).
 */

import type { CheckCode, R2Credentials } from './credentials'
import {
  classifyR2Failure,
  r2FailureMessage,
  s3ErrorCode,
  type R2Failure,
} from './r2Errors'
import { r2Request, type R2RequestInput } from './r2Sign'
import {
  fileKind,
  KIND_ORDER,
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
  /** Site-root-relative page to link; `''` is the site home. */
  bookPath: string
  onProgress?: (progress: PublishProgress) => void
}

export interface PublishDeps {
  fetch?: typeof fetch
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
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

const CONTENT_TYPES: readonly (readonly [string, string])[] = [
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
]

export function contentTypeOf(key: string): string {
  const lower = key.toLowerCase()
  const known = CONTENT_TYPES.find(([ext]) => lower.endsWith(`.${ext}`))
  return known?.[1] ?? 'application/octet-stream'
}

/** P6: content-hashed assets are immutable; pages, data and the rest revalidate. */
export function cacheControlOf(key: string): string {
  if (key === PUBLISH_MANIFEST_KEY) return CACHE_NO_STORE
  if (fileKind(key) !== 'asset') return CACHE_NO_CACHE
  // ≥ 16 hex in the last path segment.
  return /[0-9a-f]{16}[^/]*$/.test(key) ? CACHE_IMMUTABLE : CACHE_NO_CACHE
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
  return new TextEncoder().encode(
    JSON.stringify({ v: 1, files: Object.fromEntries(files) }),
  )
}

class R2Error extends Error {
  constructor(readonly failure: R2Failure) {
    super(`R2 ${failure.code}`)
  }
}

type Attempt =
  | { response: Response }
  | { failure: R2Failure; transient: boolean; waitMs: number | undefined }

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

/** A 429's `Retry-After` in whole seconds, capped at 10 s. */
function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after') ?? ''
  return response.status === 429 && /^\d+$/.test(header)
    ? Math.min(Number(header) * 1000, RETRY_AFTER_MAX_MS)
    : undefined
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

/** Files by kind group in upload order, input order within each. */
function kindGroups(files: readonly PublishSiteFile[]): PublishSiteFile[][] {
  return KIND_ORDER.map((kind) =>
    files.filter((file) => fileKind(file.key) === kind),
  )
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
    // Aborted only by the 30 s timeout (a late abort of a settled request is a no-op).
    const timeout = new AbortController()
    void sleep(REQUEST_TIMEOUT_MS).then(() => {
      timeout.abort()
    })
    try {
      const response = await doFetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        body: (request.body ?? null) as BodyInit | null,
        cache: 'no-store',
        // A redirect would replay the signed request; never follow one.
        redirect: 'error',
        signal: timeout.signal,
      })
      if (response.ok) return { response }
      const failure = classifyR2Failure({
        status: response.status,
        s3Code: await response.text().then(s3ErrorCode, () => undefined),
      })
      if (missingIsOk && response.status === 404 && failure.code !== 'bucket') {
        return { response }
      }
      return {
        failure,
        transient: isTransientStatus(response.status),
        waitMs: retryAfterMs(response),
      }
    } catch {
      const timedOut = timeout.signal.aborted
      const online = isOnline()
      return {
        failure: classifyR2Failure({ timedOut, online }),
        transient: timedOut || online,
        waitMs: undefined,
      }
    }
  }

  /** One request with P4 retries; throws `R2Error` on the final failure. */
  const send = async (
    request: Omit<R2RequestInput, 'now'>,
    missingIsOk: boolean,
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
    send(
      {
        method: 'PUT',
        key: PUBLISH_MANIFEST_KEY,
        body: manifestBytes(files),
        contentType: contentTypeOf(PUBLISH_MANIFEST_KEY),
        cacheControl: CACHE_NO_STORE,
      },
      false,
    )

  let live = new Map<string, string>()
  let puts: PublishSiteFile[] = []
  let sent = 0
  let writePartial = false
  try {
    const got = await send({ method: 'GET', key: PUBLISH_MANIFEST_KEY }, true)
    const remote = got.status === 404 ? {} : parseManifest(await got.text())
    writePartial = true
    live = new Map(Object.entries(remote))
    const plan = planUpload(input.files, remote)
    const putKeys = new Set(
      plan.filter((step) => step.op === 'put').map((step) => step.key),
    )
    puts = input.files.filter((file) => putKeys.has(file.key))
    const deletes = plan.filter(
      (step): step is Extract<UploadStep, { op: 'delete' }> =>
        step.op === 'delete',
    )
    const totalBytes = puts.reduce(
      (sum, file) => sum + file.bytes.byteLength,
      0,
    )
    let sentBytes = 0
    input.onProgress?.({ phase: 'upload', done: 0, total: totalBytes })
    for (const group of kindGroups(puts)) {
      await inPool(group, PUT_CONCURRENCY, async (file) => {
        await send(
          {
            method: 'PUT',
            key: file.key,
            body: file.bytes,
            contentType: contentTypeOf(file.key),
            cacheControl: cacheControlOf(file.key),
          },
          false,
        )
        live.set(file.key, file.sha256)
        sent += 1
        sentBytes += file.bytes.byteLength
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
        input.bookPath,
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
