/**
 * Page client of the same-origin Cloudflare API relay `/api/cf/*` (the API
 * itself sends no CORS headers). The setup token lives only in the closure of
 * `createCfApi`: it is sent as `Authorization` and never kept, logged or put
 * in a URL. Messages go through `redact`, which also hides the token.
 */

import type { CheckCode } from './credentials'
import { r2FailureMessage, type R2Failure } from './r2Errors'

export const CF_TIMEOUT_MS = 15_000
const RELAY = '/api/cf'

/**
 * `token`: 401, or 1000 / 6003 (invalid token or header). `forbidden`: 403,
 * or 9109 / 10000 (missing permission). `r2-off`: 10042 (R2 not enabled).
 */
export type CfErrorCode =
  | 'offline'
  | 'timeout'
  | 'token'
  | 'forbidden'
  | 'r2-off'
  | 'conflict'
  | 'other'

export interface CfFailure {
  ok: false
  code: CfErrorCode
  status?: number
  /** First Cloudflare error code of the response, when any. */
  cfCode?: number
  /** Redacted. */
  message: string
}

type CfResult<T> = { ok: true; result: T } | CfFailure

type CfMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface CfApi {
  /** `path` below `https://api.cloudflare.com/client/v4`, e.g. `/accounts`. */
  request: <T>(
    method: CfMethod,
    path: string,
    body?: unknown,
  ) => Promise<CfResult<T>>
}

export interface CfApiDeps {
  fetch?: typeof fetch
  /** `navigator.onLine` by default. */
  isOnline?: () => boolean
}

const TOKEN_CODES: readonly (number | undefined)[] = [1000, 6003]
const FORBIDDEN_CODES: readonly (number | undefined)[] = [9109, 10000]
const R2_OFF = 10042

interface Envelope {
  success?: unknown
  errors?: unknown
  result?: unknown
}

function firstErrorCode(envelope: Envelope | undefined): number | undefined {
  const errors = envelope?.errors
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined
  const code =
    typeof first === 'object' && first !== null
      ? (first as { code?: unknown }).code
      : undefined
  return typeof code === 'number' ? code : undefined
}

function responseCode(status: number, cfCode: number | undefined): CfErrorCode {
  if (cfCode === R2_OFF) return 'r2-off'
  if (status === 401 || TOKEN_CODES.includes(cfCode)) return 'token'
  if (status === 403 || FORBIDDEN_CODES.includes(cfCode)) return 'forbidden'
  if (status === 409) return 'conflict'
  return 'other'
}

function messageCode(code: CfErrorCode): CheckCode {
  return code === 'offline' || code === 'timeout' ? code : 'other'
}

export function createCfApi(token: string, deps: CfApiDeps): CfApi {
  const doFetch = deps.fetch ?? fetch
  const isOnline = deps.isOnline ?? (() => navigator.onLine)
  // The publish-credentials wording; the token is redacted like a secret.
  const failure = (
    code: CfErrorCode,
    status?: number,
    cfCode?: number,
  ): CfFailure => {
    const reading: R2Failure = {
      code: messageCode(code),
      ...(status === undefined ? {} : { status }),
      ...(cfCode === undefined ? {} : { s3Code: String(cfCode) }),
    }
    const secret = { accessKeyId: '', secretAccessKey: token }
    return {
      ok: false,
      code,
      ...(status === undefined ? {} : { status }),
      ...(cfCode === undefined ? {} : { cfCode }),
      message: r2FailureMessage(
        reading,
        { ...secret, accountId: '', bucket: '', publicBaseUrl: '' },
        'connect',
        CF_TIMEOUT_MS,
      ),
    }
  }

  return {
    request: async (method, path, body) => {
      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, CF_TIMEOUT_MS)
      try {
        const response = await doFetch(`${RELAY}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          cache: 'no-store',
          redirect: 'error',
          signal: controller.signal,
        })
        const envelope = (await response.json().catch(() => undefined)) as
          Envelope | undefined
        if (response.ok && envelope?.success === true) {
          return { ok: true, result: envelope.result as never }
        }
        const cfCode = firstErrorCode(envelope)
        return failure(
          responseCode(response.status, cfCode),
          response.status,
          cfCode,
        )
      } catch {
        if (controller.signal.aborted) return failure('timeout')
        return failure(isOnline() ? 'other' : 'offline')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
