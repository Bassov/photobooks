import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { R2Credentials } from './credentials'
import {
  classifyR2Failure,
  r2FailureMessage,
  s3ErrorCode,
  type R2Failure,
} from './r2Errors'

const CREDENTIALS: R2Credentials = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'my-books',
  accessKeyId: 'AKIDEXAMPLEKEY000001',
  secretAccessKey: 'wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY01',
  publicBaseUrl: 'https://books.example.com',
}

const xml = (code: string) =>
  `<?xml version="1.0"?><Error><Code>${code}</Code><Message>m</Message></Error>`

describe('s3ErrorCode', () => {
  it('reads a plain identifier Code only', () => {
    expect(s3ErrorCode(xml('NoSuchKey'))).toBe('NoSuchKey')
    expect(s3ErrorCode(xml('No Such'))).toBeUndefined()
    expect(s3ErrorCode('')).toBeUndefined()
  })
})

describe('classifyR2Failure', () => {
  it.each([
    [403, 'InvalidAccessKeyId', 'key'],
    [403, 'SignatureDoesNotMatch', 'key'],
    [403, 'AccessDenied', 'denied'],
    [404, 'NoSuchBucket', 'bucket'],
    [404, 'NoSuchKey', 'other'],
    [401, 'AccessDenied', 'other'],
    [400, 'InvalidAccessKeyId', 'other'],
    [503, 'SlowDown', 'other'],
  ] as const)('%i %s → %s', (status, code, expected) => {
    expect(classifyR2Failure({ status, body: xml(code) })).toEqual({
      code: expected,
      status,
      s3Code: code,
    })
  })

  it('a response without an S3 code is other with its status', () => {
    expect(classifyR2Failure({ status: 403, body: 'nope' })).toEqual({
      code: 'other',
      status: 403,
    })
  })

  it('a thrown fetch: timeout first, then online → cors, offline', () => {
    expect(classifyR2Failure({ timedOut: true, online: false })).toEqual({
      code: 'timeout',
    })
    expect(classifyR2Failure({ timedOut: false, online: true })).toEqual({
      code: 'cors',
    })
    expect(classifyR2Failure({ timedOut: false, online: false })).toEqual({
      code: 'offline',
    })
  })
})

describe('r2FailureMessage', () => {
  it('words a key failure by mode', () => {
    const failure: R2Failure = { code: 'key', status: 403 }

    expect(r2FailureMessage(failure, CREDENTIALS, 'connect', 15_000)).toBe(
      "Cloudflare doesn't recognise this key. Check the access key ID and secret.",
    )
    expect(r2FailureMessage(failure, CREDENTIALS, 'recheck', 15_000)).toBe(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
    )
  })

  it('names the bucket, the timeout and the answer', () => {
    const message = (failure: R2Failure, timeoutMs = 15_000) =>
      r2FailureMessage(failure, CREDENTIALS, 'recheck', timeoutMs)

    expect(message({ code: 'denied' })).toBe(
      "This token can't write to “my-books”. Give it Object Read & Write on this bucket.",
    )
    expect(message({ code: 'bucket' })).toBe(
      "There's no bucket “my-books” in this account.",
    )
    expect(message({ code: 'timeout' }, 30_000)).toBe(
      "Cloudflare didn't answer in 30 seconds. Try again.",
    )
    expect(message({ code: 'cors' })).toBe(
      'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
    )
    expect(message({ code: 'offline' })).toBe(
      "You're offline. Connect to the internet and try again.",
    )
    expect(
      message({ code: 'other', status: 500, s3Code: 'InternalError' }),
    ).toBe(
      'Cloudflare answered 500 InternalError. Check the values and try again.',
    )
    expect(message({ code: 'other', status: 502 })).toBe(
      'Cloudflare answered 502. Check the values and try again.',
    )
  })

  it('never carries the secret, even in a bucket name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'key',
          'denied',
          'bucket',
          'timeout',
          'cors',
          'offline',
          'other',
        ),
        fc.boolean(),
        (code, connect) => {
          const credentials = {
            ...CREDENTIALS,
            bucket: CREDENTIALS.secretAccessKey,
          }
          const message = r2FailureMessage(
            { code, status: 500 },
            credentials,
            connect ? 'connect' : 'recheck',
            15_000,
          )
          expect(message).not.toContain(CREDENTIALS.secretAccessKey)
        },
      ),
    )
  })
})
