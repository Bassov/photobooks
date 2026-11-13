/**
 * Publish: upload a hashed site tree to the user's R2 bucket against the
 * remote manifest of the last publish. Pure orchestration over an injected
 * `fetch` / clock / sleep; credentials only sign requests and never appear in
 * a result (messages go through `redact`).
 */

import type { R2Credentials } from './credentials'
import type {
  PublishDeps,
  PublisherCapabilities,
  PublishInput,
  PublishResult,
  PublishSiteFile,
} from './publisher'
import {
  classifyR2Failure,
  r2FailureMessage,
  s3ErrorCode,
  type R2Failure,
} from './r2Errors'
import { r2Request, type R2RequestInput, type R2SignedRequest } from './r2Sign'
import {
  fileKind,
  KIND_ORDER,
  planUpload,
  type RemoteManifest,
  type UploadStep,
} from './uploadPlan'

export const PUBLISH_MANIFEST_KEY = '_photobooks/publish-manifest.json'
export const REQUEST_TIMEOUT_MS = 30_000
/** Waits before the 2nd and 3rd attempt; 3 attempts in total. */
const RETRY_WAITS_MS: readonly number[] = [1_000, 3_000]
const RETRY_AFTER_MAX_MS = 10_000
export const R2_CAPABILITIES: PublisherCapabilities = {
  immutableCache: true,
  maxParallelUploads: 4,
  deletes: true,
}
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'
export const CACHE_NO_CACHE = 'no-cache'
export const CACHE_NO_STORE = 'no-store'

export interface PublishSiteInput extends PublishInput {
  credentials: R2Credentials
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

/** A Vite build file of the viewer: `viewer/assets/<name>-<8-char hash>.<ext>`. */
const VITE_BUILD_FILE = /^viewer\/assets\/[^/]+-([\w-]{8})(?:\.[A-Za-z0-9]+)+$/

/** True when a Vite-style name carries a hash, not a word (`my-settings.js`). */
function isViteHashed(key: string): boolean {
  const hash = VITE_BUILD_FILE.exec(key)?.[1]
  return hash !== undefined && /[A-Z0-9]/.test(hash)
}

/** P6: content-hashed assets are immutable; pages, data and the rest revalidate. */
export function cacheControlOf(key: string): string {
  if (key === PUBLISH_MANIFEST_KEY) return CACHE_NO_STORE
  if (fileKind(key) !== 'asset') return CACHE_NO_CACHE
  // ≥ 16 hex in the last path segment (content-hash keys), or a Vite build hash.
  return /[0-9a-f]{16}[^/]*$/.test(key) || isViteHashed(key)
    ? CACHE_IMMUTABLE
    : CACHE_NO_CACHE
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

/**
 * Runs `task` over `items` in order, at most `limit` in flight: item `k` starts only once item
 * `k - limit` has settled and no item has failed, so a failure stops every later item whatever
 * order replies arrive in. The first failure is rethrown once the started items settle.
 *
 * `prepare` (signing: no request) runs `limit` items ahead of the window, and the first `limit`
 * items start together once all are prepared, so the window holds `limit` requests on the wire
 * and a refill goes out as soon as its slot frees, not after its own signing.
 */
async function inPool<T, P>(
  items: readonly T[],
  limit: number,
  prepare: (item: T) => Promise<P>,
  run: (prepared: P) => Promise<void>,
): Promise<void> {
  const errors: unknown[] = []
  const settled: Promise<void>[] = []
  const ready: Promise<P>[] = []
  const prepareUpTo = (end: number) => {
    for (const item of items.slice(ready.length, end)) {
      const next = prepare(item)
      // Handled where the item starts; one never started must not reject unhandled.
      next.catch(() => undefined)
      ready.push(next)
    }
  }
  prepareUpTo(limit)
  await Promise.allSettled(ready)
  // `ready` grows by one per started item; the array iterator sees the new entries.
  for (const [index, next] of ready.entries()) {
    if (index >= limit) await settled[index - limit]
    if (errors.length > 0) break
    prepareUpTo(index + limit + 1)
    settled.push(
      next.then(run).catch((error: unknown) => {
        errors.push(error)
      }),
    )
  }
  await Promise.all(settled)
  if (errors.length > 0) throw errors[0]
}

/** Files by kind group in upload order, input order within each. */
function kindGroups(files: readonly PublishSiteFile[]): PublishSiteFile[][] {
  return KIND_ORDER.map((kind) =>
    files.filter((file) => fileKind(file.key) === kind),
  )
}

/**
 * GET the manifest (404 → empty), put the new or changed files `maxParallelUploads` at a time
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

  const sign = (request: Omit<R2RequestInput, 'now'>) =>
    r2Request(credentials, { ...request, now: now() })

  /** Fetches synchronously from the call: a signed request goes out with no await before it. */
  const attempt = async (
    request: Omit<R2RequestInput, 'now'>,
    signed: R2SignedRequest,
    missingIsOk: boolean,
  ): Promise<Attempt> => {
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

  /**
   * One request with P4 retries, the first try already `signed`; a retry signs anew. Throws
   * `R2Error` on the final failure.
   */
  const sendSigned = async (
    request: Omit<R2RequestInput, 'now'>,
    signed: R2SignedRequest,
    missingIsOk: boolean,
  ): Promise<Response> => {
    let next = signed
    for (let tries = 0; ; tries += 1) {
      const result = await attempt(request, next, missingIsOk)
      if ('response' in result) return result.response
      const wait = RETRY_WAITS_MS[tries]
      if (!result.transient || wait === undefined) {
        throw new R2Error(result.failure)
      }
      await sleep(result.waitMs ?? wait)
      next = await sign(request)
    }
  }

  const send = async (
    request: Omit<R2RequestInput, 'now'>,
    missingIsOk: boolean,
  ): Promise<Response> => sendSigned(request, await sign(request), missingIsOk)

  /** Pool `prepare`: the request and its first signature. */
  const signAhead = async (request: Omit<R2RequestInput, 'now'>) => ({
    request,
    signed: await sign(request),
  })

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
      const signPut = async (file: PublishSiteFile) => ({
        file,
        ...(await signAhead({
          method: 'PUT',
          key: file.key,
          body: file.bytes,
          contentType: contentTypeOf(file.key),
          cacheControl: cacheControlOf(file.key),
        })),
      })
      await inPool(
        group,
        R2_CAPABILITIES.maxParallelUploads,
        signPut,
        async (put) => {
          const { file } = put
          await sendSigned(put.request, put.signed, false)
          live.set(file.key, file.sha256)
          sent += 1
          sentBytes += file.bytes.byteLength
          input.onProgress?.({
            phase: 'upload',
            done: sentBytes,
            total: totalBytes,
          })
        },
      )
    }
    const finishTotal = deletes.length + 1
    let finished = 0
    input.onProgress?.({ phase: 'finish', done: 0, total: finishTotal })
    const signDelete = (step: (typeof deletes)[number]) =>
      signAhead({ method: 'DELETE', key: step.key })
    await inPool(
      deletes,
      R2_CAPABILITIES.maxParallelUploads,
      signDelete,
      async (del) => {
        await sendSigned(del.request, del.signed, true)
        live.delete(del.request.key)
        finished += 1
        input.onProgress?.({
          phase: 'finish',
          done: finished,
          total: finishTotal,
        })
      },
    )
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
