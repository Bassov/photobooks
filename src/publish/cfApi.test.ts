import { afterEach, describe, expect, it, vi } from 'vitest'
import { CF_TIMEOUT_MS, createCfApi, type CfErrorCode } from './cfApi'
import { cfError, cfOk, SETUP_TOKEN } from './fakeCloudflare.test-helpers'

afterEach(() => {
  vi.useRealTimers()
})

function api(answer: () => Response | Promise<Response>, online = true) {
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(answer()))
  return {
    fetch,
    api: createCfApi(SETUP_TOKEN, { fetch, isOnline: () => online }),
  }
}

describe('createCfApi', () => {
  it('sends the token as Authorization to the same-origin relay', async () => {
    const { fetch, api: client } = api(() => cfOk([{ id: 'a' }]))

    expect(await client.request('GET', '/accounts')).toEqual({
      ok: true,
      result: [{ id: 'a' }],
    })
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('/api/cf/accounts')
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Authorization: `Bearer ${SETUP_TOKEN}` },
      cache: 'no-store',
      redirect: 'error',
    })
    expect(init?.body).toBeUndefined()
    expect(init?.headers).not.toHaveProperty('Content-Type')
  })

  it('sends a body as JSON', async () => {
    const { fetch, api: client } = api(() => cfOk({ name: 'b' }))

    await client.request('POST', '/accounts/x/r2/buckets', { name: 'b' })

    const init = fetch.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"b"}')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  const cases: [string, () => Response, CfErrorCode, string][] = [
    ['401', () => cfError(401), 'token', 'Cloudflare answered 401.'],
    [
      '400 code 1000',
      () => cfError(400, 1000),
      'token',
      'Cloudflare answered 400 1000.',
    ],
    [
      '400 code 6003',
      () => cfError(400, 6003),
      'token',
      'Cloudflare answered 400 6003.',
    ],
    ['403', () => cfError(403), 'forbidden', 'Cloudflare answered 403.'],
    [
      '400 code 9109',
      () => cfError(400, 9109),
      'forbidden',
      'Cloudflare answered 400 9109.',
    ],
    [
      '400 code 10000',
      () => cfError(400, 10000),
      'forbidden',
      'Cloudflare answered 400 10000.',
    ],
    [
      '403 code 10042',
      () => cfError(403, 10042),
      'r2-off',
      'Cloudflare answered 403 10042.',
    ],
    [
      '409',
      () => cfError(409, 10004),
      'conflict',
      'Cloudflare answered 409 10004.',
    ],
    ['500', () => cfError(500, 7003), 'other', 'Cloudflare answered 500 7003.'],
    [
      '200 without success',
      () => Response.json({ result: 1 }),
      'other',
      'Cloudflare answered 200.',
    ],
    [
      '502 not JSON',
      () => new Response('<html>', { status: 502 }),
      'other',
      'Cloudflare answered 502.',
    ],
    [
      'an errors entry without a numeric code',
      () =>
        Response.json(
          { success: false, errors: [{ code: '7' }] },
          { status: 400 },
        ),
      'other',
      'Cloudflare answered 400.',
    ],
    [
      'errors that are not a list',
      () => Response.json({ success: false, errors: 'x' }, { status: 400 }),
      'other',
      'Cloudflare answered 400.',
    ],
    [
      'a null errors entry',
      () => Response.json({ success: false, errors: [null] }, { status: 400 }),
      'other',
      'Cloudflare answered 400.',
    ],
  ]

  it.each(cases)('maps %s', async (_name, answer, code, message) => {
    const result = await api(answer).api.request('GET', '/user/tokens/verify')

    expect(result).toMatchObject({ ok: false, code })
    expect(result.ok ? '' : result.message).toBe(
      `${message} Check the values and try again.`,
    )
  })

  it('keeps the status and Cloudflare code', async () => {
    expect(
      await api(() => cfError(409, 10004)).api.request('GET', '/x'),
    ).toMatchObject({ status: 409, cfCode: 10004 })
    const bare = await api(() => cfError(500)).api.request('GET', '/x')
    expect(bare).toMatchObject({ status: 500 })
    expect(bare).not.toHaveProperty('cfCode')
  })

  it('maps a thrown fetch to offline, or other while online', async () => {
    const thrown = () => {
      throw new TypeError('Failed to fetch')
    }

    expect(await api(thrown, false).api.request('GET', '/accounts')).toEqual({
      ok: false,
      code: 'offline',
      message: "You're offline. Connect to the internet and try again.",
    })
    expect(await api(thrown, true).api.request('GET', '/accounts')).toEqual({
      ok: false,
      code: 'other',
      message: 'Something went wrong. Try again.',
    })
  })

  it('reads navigator.onLine by default', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const client = createCfApi(SETUP_TOKEN, {
      fetch: () => Promise.reject(new TypeError('x')),
    })
    expect(await client.request('GET', '/accounts')).toMatchObject({
      code: 'offline',
    })
    vi.unstubAllGlobals()
  })

  it('times out after 15 s', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const client = createCfApi(SETUP_TOKEN, {
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          signal = init?.signal ?? undefined
          signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
      isOnline: () => true,
    })

    const pending = client.request('GET', '/accounts')
    await vi.advanceTimersByTimeAsync(CF_TIMEOUT_MS - 1)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await pending).toEqual({
      ok: false,
      code: 'timeout',
      message: "Cloudflare didn't answer in 15 seconds. Try again.",
    })
  })

  it('clears its timer once answered', async () => {
    vi.useFakeTimers()
    await api(() => cfOk(1)).api.request('GET', '/accounts')
    expect(vi.getTimerCount()).toBe(0)
  })
})
