/**
 * Settings → Hosting "Connect" / "Check again": a real signed write, read and
 * delete of a check object on the R2 S3 endpoint. Credentials are saved only
 * after all three succeed. Messages go through `redact` and read nothing from
 * a response body but its S3 error `Code`.
 */

import {
  createCredentialStore,
  redact,
  validateCredentials,
  type CheckCode,
  type HostingStatus,
  type R2Credentials,
} from './credentials'
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

const KEY_CODES = ['InvalidAccessKeyId', 'SignatureDoesNotMatch']

function defaultRandomHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/** The S3 error `Code`, only when it is a plain identifier. */
function s3Code(body: string): string | undefined {
  return /<Code>([A-Za-z0-9]{1,64})<\/Code>/.exec(body)?.[1]
}

function clock(deps: CheckDeps): () => Date {
  return deps.now ?? (() => new Date())
}

type Failure = Extract<CheckResult, { ok: false }>

function failure(
  code: CheckCode,
  message: string,
  credentials: R2Credentials,
  fields: readonly CheckField[] = [],
): Failure {
  return { ok: false, code, message: redact(message, credentials), fields }
}

async function responseFailure(
  response: Response,
  credentials: R2Credentials,
  mode: CheckMode,
): Promise<Failure> {
  const code = s3Code(await response.text().catch(() => ''))
  const { status } = response
  const { bucket } = credentials
  if (status === 403 && code !== undefined && KEY_CODES.includes(code)) {
    return failure(
      'key',
      mode === 'connect'
        ? "Cloudflare doesn't recognise this key. Check the access key ID and secret."
        : "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
      credentials,
      ['accessKeyId', 'secretAccessKey'],
    )
  }
  if (status === 403 && code === 'AccessDenied') {
    return failure(
      'denied',
      `This token can't write to “${bucket}”. Give it Object Read & Write on this bucket.`,
      credentials,
    )
  }
  if (status === 404 && code === 'NoSuchBucket') {
    return failure(
      'bucket',
      `There's no bucket “${bucket}” in this account.`,
      credentials,
      ['accountId', 'bucket'],
    )
  }
  const answer = [String(status), code].filter(Boolean).join(' ')
  return failure(
    'other',
    `Cloudflare answered ${answer}. Check the values and try again.`,
    credentials,
  )
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
    if (controller.signal.aborted) {
      return failure(
        'timeout',
        "Cloudflare didn't answer in 15 seconds. Try again.",
        credentials,
      )
    }
    return isOnline()
      ? failure(
          'cors',
          'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
          credentials,
        )
      : failure(
          'offline',
          "You're offline. Connect to the internet and try again.",
          credentials,
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
