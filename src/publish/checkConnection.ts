/**
 * Settings → Hosting "Connect" / "Check again": a real signed write, read and
 * delete of a check object on the R2 S3 endpoint. Credentials are saved only
 * after all three succeed. Messages go through `redact` and read nothing from
 * a response body but its S3 error `Code`.
 */

import {
  createCredentialStore,
  validateCredentials,
  type CheckCode,
  type HostingStatus,
  type R2Credentials,
} from './credentials'
import {
  classifyR2Failure,
  r2FailureMessage,
  type R2FailureInput,
} from './r2Errors'
import { r2Request, type R2RequestInput } from './r2Sign'

export const CHECK_TIMEOUT_MS = 15_000
const CHECK_PREFIX = '_photobooks/check-'

type CheckField = keyof R2Credentials

export type CheckResult =
  | { ok: true }
  | {
      ok: false
      code: CheckCode
      /** Footer message, redacted. */
      message: string
      /** Fields to ring red. */
      fields: readonly CheckField[]
    }

export interface CheckDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** `navigator.onLine` by default. */
  isOnline?: () => boolean
  /** 4 random bytes by default. */
  randomHex?: () => string
}

export type CheckMode = 'connect' | 'recheck'

/** Fields to ring red per failure code. */
const FIELDS: Partial<Record<CheckCode, readonly CheckField[]>> = {
  key: ['accessKeyId', 'secretAccessKey'],
  bucket: ['accountId', 'bucket'],
}

function defaultRandomHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function clock(deps: CheckDeps): () => Date {
  return deps.now ?? (() => new Date())
}

type Failure = Extract<CheckResult, { ok: false }>

function failure(
  input: R2FailureInput,
  credentials: R2Credentials,
  mode: CheckMode,
): Failure {
  const classified = classifyR2Failure(input)
  return {
    ok: false,
    code: classified.code,
    message: r2FailureMessage(classified, credentials, mode, CHECK_TIMEOUT_MS),
    fields: FIELDS[classified.code] ?? [],
  }
}

async function responseFailure(
  response: Response,
  credentials: R2Credentials,
  mode: CheckMode,
): Promise<Failure> {
  const body = await response.text().catch(() => '')
  return failure({ status: response.status, body }, credentials, mode)
}

/**
 * PUT `_photobooks/check-<8 hex>.txt` (`ok`, `text/plain`), HEAD it, DELETE
 * it — all within 15 s. A failed HEAD still tries the DELETE. Throws,
 * before any request, an error naming the invalid fields only.
 */
export async function checkConnection(
  credentials: R2Credentials,
  mode: CheckMode,
  deps: CheckDeps = {},
): Promise<CheckResult> {
  const checked = validateCredentials(credentials)
  if (!checked.ok) {
    throw new Error(
      `Invalid hosting credentials: ${Object.keys(checked.errors).join(', ')}`,
    )
  }
  const doFetch = deps.fetch ?? fetch
  const now = clock(deps)
  const isOnline = deps.isOnline ?? (() => navigator.onLine)
  const key = `${CHECK_PREFIX}${(deps.randomHex ?? defaultRandomHex)()}.txt`
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, CHECK_TIMEOUT_MS)

  const send = async (
    method: R2RequestInput['method'],
    body?: Uint8Array,
  ): Promise<Response> => {
    const request = await r2Request(credentials, {
      method,
      key,
      now: now(),
      ...(body === undefined ? {} : { body, contentType: 'text/plain' }),
    })
    return doFetch(request.url, {
      method,
      headers: request.headers,
      ...(body === undefined ? {} : { body: body as BodyInit }),
      cache: 'no-store',
      // A redirect would replay the signed request; never follow one.
      redirect: 'error',
      signal: controller.signal,
    })
  }

  try {
    const put = await send('PUT', new TextEncoder().encode('ok'))
    if (!put.ok) return await responseFailure(put, credentials, mode)
    const head = await send('HEAD')
    if (!head.ok) {
      await send('DELETE').catch(() => undefined)
      return await responseFailure(head, credentials, mode)
    }
    const remove = await send('DELETE')
    if (!remove.ok) return await responseFailure(remove, credentials, mode)
    return { ok: true }
  } catch {
    return failure(
      { timedOut: controller.signal.aborted, online: isOnline() },
      credentials,
      mode,
    )
  } finally {
    clearTimeout(timer)
  }
}

export interface HostingDeps extends CheckDeps {
  indexedDB?: IDBFactory
}

/** Connect: check first; save the credentials and an `ok` status only on a pass. */
export async function connectHosting(
  credentials: R2Credentials,
  deps: HostingDeps = {},
): Promise<CheckResult> {
  const result = await checkConnection(credentials, 'connect', deps)
  if (!result.ok) return result
  const store = createCredentialStore(deps.indexedDB)
  await store.save(credentials)
  await store.saveStatus({
    checkedAtMs: clock(deps)().getTime(),
    ok: true,
  })
  return result
}

/**
 * Check again: re-checks the stored credentials and stores the result.
 * `null` when nothing is stored.
 */
export async function recheckHosting(
  deps: HostingDeps = {},
): Promise<HostingStatus | null> {
  const store = createCredentialStore(deps.indexedDB)
  const credentials = await store.load()
  if (credentials === undefined) return null
  const result = await checkConnection(credentials, 'recheck', deps)
  const checkedAtMs = clock(deps)().getTime()
  const status: HostingStatus = result.ok
    ? { checkedAtMs, ok: true }
    : { checkedAtMs, ok: false, code: result.code, message: result.message }
  await store.saveStatus(status)
  return status
}
