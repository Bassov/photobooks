/**
 * One reading of an R2 failure for Connect / Check again and Publish: a
 * response by status and S3 error `Code`, a thrown fetch by timeout and
 * `navigator.onLine`. Nothing of a response body but its `Code` is kept.
 */

import { redact, type CheckCode, type R2Credentials } from './credentials'

export interface R2Failure {
  code: CheckCode
  status?: number
  s3Code?: string
}

/** A response by status and its body's S3 `Code` (see `s3ErrorCode`), or a thrown fetch. */
export type R2FailureInput =
  | { status: number; s3Code: string | undefined }
  | { timedOut: boolean; online: boolean }

const KEY_CODES: readonly (string | undefined)[] = [
  'InvalidAccessKeyId',
  'SignatureDoesNotMatch',
]

/** The S3 error `Code`, only when it is a plain identifier. */
export function s3ErrorCode(body: string): string | undefined {
  return /<Code>([A-Za-z0-9]{1,64})<\/Code>/.exec(body)?.[1]
}

function responseCode(status: number, s3Code: string | undefined): CheckCode {
  if (status === 403 && KEY_CODES.includes(s3Code)) return 'key'
  if (status === 403 && s3Code === 'AccessDenied') return 'denied'
  if (status === 404 && s3Code === 'NoSuchBucket') return 'bucket'
  return 'other'
}

export function classifyR2Failure(input: R2FailureInput): R2Failure {
  if ('status' in input) {
    const { status, s3Code } = input
    return {
      code: responseCode(status, s3Code),
      status,
      ...(s3Code === undefined ? {} : { s3Code }),
    }
  }
  if (input.timedOut) return { code: 'timeout' }
  return { code: input.online ? 'cors' : 'offline' }
}

/** `connect`: the key was just typed; `recheck`: a stored key went bad. */
export type R2MessageMode = 'connect' | 'recheck'

function rawMessage(
  failure: R2Failure,
  bucket: string,
  mode: R2MessageMode,
  timeoutMs: number,
): string {
  switch (failure.code) {
    case 'key':
      return mode === 'connect'
        ? "Cloudflare doesn't recognise this key. Check the access key ID and secret."
        : "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token."
    case 'denied':
      return `This token can't write to “${bucket}”. Give it Object Read & Write on this bucket.`
    case 'bucket':
      return `There's no bucket “${bucket}” in this account.`
    case 'timeout':
      return `Cloudflare didn't answer in ${String(timeoutMs / 1000)} seconds. Try again.`
    case 'cors':
      return 'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.'
    case 'offline':
      return "You're offline. Connect to the internet and try again."
    case 'other': {
      const answer = [
        failure.status === undefined ? undefined : String(failure.status),
        failure.s3Code,
      ]
        .filter(Boolean)
        .join(' ')
      if (answer === '') return 'Something went wrong. Try again.'
      return `Cloudflare answered ${answer}. Check the values and try again.`
    }
  }
}

/** The footer / status message for `failure`, redacted. */
export function r2FailureMessage(
  failure: R2Failure,
  credentials: R2Credentials,
  mode: R2MessageMode,
  timeoutMs: number,
): string {
  return redact(
    rawMessage(failure, credentials.bucket, mode, timeoutMs),
    credentials,
  )
}
