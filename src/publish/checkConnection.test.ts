import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_TIMEOUT_MS,
  checkConnection,
  type CheckDeps,
} from './checkConnection'
import { connectHosting, recheckHosting } from './hosting'
import {
  createCredentialStore,
  loadHostingSummary,
  type R2Credentials,
} from './credentials'

const CREDENTIALS: R2Credentials = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'my-books',
  accessKeyId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  secretAccessKey:
    'f00dfeedc0ffee11deadbeef22cafebabe3344556677889900aabbccddeeff01',
  publicBaseUrl: 'https://books.example.com',
}
const CHECK_URL = `https://${CREDENTIALS.accountId}.r2.cloudflarestorage.com/my-books/_photobooks/check-0a1b2c3d.txt`
const NOW = new Date('2026-11-12T22:40:00Z')

const s3Error = (status: number, code: string) =>
  new Response(`<?xml version="1.0"?><Error><Code>${code}</Code></Error>`, {
    status,
  })

type Answer = Response | Error

function fakeFetch(...answers: Answer[]) {
  const queue = [...answers]
  return vi.fn<typeof fetch>(() => {
    const answer = queue.shift() ?? new Response(null, { status: 200 })
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer)
  })
}

function deps(fetchMock: typeof fetch, extra: Partial<CheckDeps> = {}) {
  return {
    fetch: fetchMock,
    now: () => NOW,
    randomHex: () => '0a1b2c3d',
    isOnline: () => true,
    ...extra,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('checkConnection', () => {
  it('signs a PUT, HEAD and DELETE of one check object', async () => {
    const fetchMock = fakeFetch()

    const result = await checkConnection(
      CREDENTIALS,
      'connect',
      deps(fetchMock),
    )

    expect(result).toEqual({ ok: true })
    const calls = fetchMock.mock.calls
    expect(calls.map(([url, init]) => [url, init?.method])).toEqual([
      [CHECK_URL, 'PUT'],
      [CHECK_URL, 'HEAD'],
      [CHECK_URL, 'DELETE'],
    ])
    const put = calls[0]?.[1]
    expect(new TextDecoder().decode(put?.body as Uint8Array)).toBe('ok')
    const headers = put?.headers as Record<string, string>
    expect(headers['content-type']).toBe('text/plain')
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/)
    expect(headers['x-amz-date']).toBe('20261112T224000Z')
    expect(calls[1]?.[1]?.body).toBeUndefined()
    expect(calls.every(([, init]) => init?.cache === 'no-store')).toBe(true)
    expect(calls.every(([, init]) => init?.redirect === 'error')).toBe(true)
    expect(calls.every(([, init]) => init?.signal instanceof AbortSignal)).toBe(
      true,
    )
  })

  it('names the check object with 8 random hex by default', async () => {
    const fetchMock = fakeFetch()

    await checkConnection(CREDENTIALS, 'connect', { fetch: fetchMock })

    expect(fetchMock.mock.calls[0]?.[0] as string).toMatch(
      /\/my-books\/_photobooks\/check-[0-9a-f]{8}\.txt$/,
    )
  })

  it.each([
    [
      s3Error(403, 'InvalidAccessKeyId'),
      'key',
      "Cloudflare doesn't recognise this key. Check the access key ID and secret.",
      ['accessKeyId', 'secretAccessKey'],
    ],
    [
      s3Error(403, 'SignatureDoesNotMatch'),
      'key',
      "Cloudflare doesn't recognise this key. Check the access key ID and secret.",
      ['accessKeyId', 'secretAccessKey'],
    ],
    [
      s3Error(403, 'AccessDenied'),
      'denied',
      "This token can't write to “my-books”. Give it Object Read & Write on this bucket.",
      [],
    ],
    [
      s3Error(404, 'NoSuchBucket'),
      'bucket',
      "There's no bucket “my-books” in this account.",
      ['accountId', 'bucket'],
    ],
    [
      s3Error(500, 'InternalError'),
      'other',
      'Cloudflare answered 500 InternalError. Check the values and try again.',
      [],
    ],
    [
      s3Error(404, 'AccessDenied'),
      'other',
      'Cloudflare answered 404 AccessDenied. Check the values and try again.',
      [],
    ],
    [
      s3Error(403, 'NoSuchBucket'),
      'other',
      'Cloudflare answered 403 NoSuchBucket. Check the values and try again.',
      [],
    ],
    [
      new Response(null, { status: 403 }),
      'other',
      'Cloudflare answered 403. Check the values and try again.',
      [],
    ],
    [
      s3Error(400, 'Bad<b>Code'),
      'other',
      'Cloudflare answered 400. Check the values and try again.',
      [],
    ],
  ])(
    'maps a PUT answer to the Spec message (%#)',
    async (answer, code, message, fields) => {
      const fetchMock = fakeFetch(answer)

      const result = await checkConnection(
        CREDENTIALS,
        'connect',
        deps(fetchMock),
      )

      expect(result).toEqual({ ok: false, code, message, fields })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('tells a re-check key failure to replace the token', async () => {
    const result = await checkConnection(
      CREDENTIALS,
      'recheck',
      deps(fakeFetch(s3Error(403, 'InvalidAccessKeyId'))),
    )

    expect(result).toMatchObject({
      code: 'key',
      message:
        "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
    })
  })

  it('maps a network TypeError to CORS online and to offline otherwise', async () => {
    const cors = await checkConnection(
      CREDENTIALS,
      'connect',
      deps(fakeFetch(new TypeError('Failed to fetch'))),
    )
    const offline = await checkConnection(
      CREDENTIALS,
      'connect',
      deps(fakeFetch(new TypeError('Failed to fetch')), {
        isOnline: () => false,
      }),
    )

    expect(cors).toEqual({
      ok: false,
      code: 'cors',
      message:
        'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
      fields: [],
    })
    expect(offline).toEqual({
      ok: false,
      code: 'offline',
      message: "You're offline. Connect to the internet and try again.",
      fields: [],
    })
  })

  it('reads navigator.onLine by default', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const result = await checkConnection(CREDENTIALS, 'connect', {
      fetch: fakeFetch(new TypeError('Failed to fetch')),
    })

    expect(result).toMatchObject({ code: 'offline' })
  })

  it('times out after 15 s across all three requests', async () => {
    vi.useFakeTimers()
    let markCalled: () => void = () => undefined
    const called = new Promise<void>((resolve) => {
      markCalled = resolve
    })
    const fetchMock = vi.fn<typeof fetch>(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
          markCalled()
        }),
    )
    let settled = false

    const pending = checkConnection(
      CREDENTIALS,
      'connect',
      deps(fetchMock),
    ).finally(() => {
      settled = true
    })
    // Signing is real async WebCrypto: let the PUT go out before the clock moves.
    await called
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await pending).toEqual({
      ok: false,
      code: 'timeout',
      message: "Cloudflare didn't answer in 15 seconds. Try again.",
      fields: [],
    })
  })

  it('clears its timer when the check ends', async () => {
    vi.useFakeTimers()

    await checkConnection(CREDENTIALS, 'connect', deps(fakeFetch()))

    expect(vi.getTimerCount()).toBe(0)
  })

  it('still deletes the check object when HEAD fails', async () => {
    const fetchMock = fakeFetch(
      new Response(null, { status: 200 }),
      new Response(null, { status: 404 }),
      new TypeError('Failed to fetch'),
    )

    const result = await checkConnection(
      CREDENTIALS,
      'connect',
      deps(fetchMock),
    )

    expect(result).toMatchObject({ ok: false, code: 'other' })
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      'PUT',
      'HEAD',
      'DELETE',
    ])
  })

  it('reports a failed DELETE', async () => {
    const result = await checkConnection(
      CREDENTIALS,
      'connect',
      deps(
        fakeFetch(
          new Response(null, { status: 200 }),
          new Response(null, { status: 200 }),
          s3Error(403, 'AccessDenied'),
        ),
      ),
    )

    expect(result).toMatchObject({ ok: false, code: 'denied' })
  })

  it('refuses invalid credentials before any request, naming fields only', async () => {
    const fetchMock = fakeFetch()
    const bad = { ...CREDENTIALS, bucket: 'B', secretAccessKey: 'x y' }

    await expect(
      checkConnection(bad, 'connect', deps(fetchMock)),
    ).rejects.toThrow(/^Invalid hosting credentials: bucket, secretAccessKey$/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('connectHosting', () => {
  it('saves the credentials and a passing status only after the check', async () => {
    const factory = new IDBFactory()

    const result = await connectHosting(CREDENTIALS, {
      ...deps(fakeFetch()),
      indexedDB: factory,
    })

    expect(result).toEqual({ ok: true })
    expect(await createCredentialStore(factory).load()).toEqual(CREDENTIALS)
    expect(await loadHostingSummary(factory)).toEqual({
      accountId: CREDENTIALS.accountId,
      bucket: 'my-books',
      accessKeyTail: 'c5d6',
      publicBaseUrl: CREDENTIALS.publicBaseUrl,
      status: { checkedAtMs: NOW.getTime(), ok: true },
      origin: 'manual',
    })
  })

  it('stores nothing when the check fails', async () => {
    const factory = new IDBFactory()

    const result = await connectHosting(CREDENTIALS, {
      ...deps(fakeFetch(s3Error(404, 'NoSuchBucket'))),
      indexedDB: factory,
    })

    expect(result).toMatchObject({ ok: false, code: 'bucket' })
    expect(await createCredentialStore(factory).load()).toBeUndefined()
    expect(await createCredentialStore(factory).loadStatus()).toBeNull()
  })
})

describe('recheckHosting', () => {
  it('is null and sends nothing when nothing is stored', async () => {
    const fetchMock = fakeFetch()

    const status = await recheckHosting({
      ...deps(fetchMock),
      indexedDB: new IDBFactory(),
    })

    expect(status).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores a failed and then a passing re-check', async () => {
    const factory = new IDBFactory()
    await connectHosting(CREDENTIALS, {
      ...deps(fakeFetch()),
      indexedDB: factory,
    })
    const later = new Date(NOW.getTime() + 60_000)

    const failed = await recheckHosting({
      ...deps(fakeFetch(s3Error(403, 'InvalidAccessKeyId')), {
        now: () => later,
      }),
      indexedDB: factory,
    })

    expect(failed).toEqual({
      checkedAtMs: later.getTime(),
      ok: false,
      code: 'key',
      message:
        "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
    })
    expect((await loadHostingSummary(factory))?.status).toEqual(failed)

    const passed = await recheckHosting({
      ...deps(fakeFetch()),
      indexedDB: factory,
    })
    expect(passed).toEqual({ checkedAtMs: NOW.getTime(), ok: true })
    expect((await loadHostingSummary(factory))?.status).toEqual(passed)
  })
})

describe('secret never leaves the check', () => {
  const { accessKeyId, secretAccessKey } = CREDENTIALS
  const forms = (value: string) => [
    value,
    encodeURIComponent(value),
    btoa(value).replace(/=*$/, ''),
  ]

  it('no message, status, summary or log line contains the key or secret', async () => {
    const logged: unknown[] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => {
        logged.push(args)
      })
    }
    const factory = new IDBFactory()
    const answers: Answer[] = [
      s3Error(403, 'InvalidAccessKeyId'),
      s3Error(403, 'AccessDenied'),
      s3Error(404, 'NoSuchBucket'),
      s3Error(403, secretAccessKey),
      s3Error(400, accessKeyId),
      new Response(`<Message>${secretAccessKey}</Message>`, { status: 500 }),
      new TypeError(`Failed to fetch ${secretAccessKey}`),
    ]
    const seen: unknown[] = []

    for (const answer of answers) {
      seen.push(
        await checkConnection(CREDENTIALS, 'connect', deps(fakeFetch(answer))),
      )
    }
    await connectHosting(CREDENTIALS, {
      ...deps(fakeFetch()),
      indexedDB: factory,
    })
    for (const answer of answers) {
      seen.push(
        await recheckHosting({
          ...deps(fakeFetch(answer)),
          indexedDB: factory,
        }),
        await loadHostingSummary(factory),
      )
    }

    const text = JSON.stringify([seen, logged])
    expect(text).toContain('[redacted]')
    for (const needle of [...forms(secretAccessKey), ...forms(accessKeyId)]) {
      expect(text).not.toContain(needle)
    }
  })
})
