// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  BUCKET_ITEM_WRITE_GROUP_ID,
  CF_API,
  MAX_BODY_BYTES,
  handleCfRelay,
  type Upstream,
} from './cfRelay'
import worker from './index'

const ORIGIN = 'https://photobooks.example'
const TOKEN = 'setupTokenValue_0123456789-abcdefghijklm'
const AUTH = `Bearer ${TOKEN}`
const ACC = '0123456789abcdef0123456789abcdef'
const ZONE = 'fedcba9876543210fedcba9876543210'
const TOKEN_ID = 'aaaabbbbccccddddeeeeffff00001111'
const BUCKET = 'photos-basov-photo'
const VERIFY_URL = `${CF_API}/user/tokens/verify`

interface Call {
  path: string
  method?: string
  body?: string
  /** Header values to set; `null` drops a default header. */
  headers?: Record<string, string | null>
}

function relayRequest({ path, method = 'GET', body, headers = {} }: Call) {
  const all: Record<string, string | null> = {
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    Authorization: AUTH,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  }
  const init: RequestInit = {
    method,
    headers: Object.entries(all).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  }
  if (body !== undefined) init.body = body
  return new Request(`${ORIGIN}/api/cf${path}`, init)
}

function okUpstream(result: unknown = { id: TOKEN_ID }) {
  return vi.fn<Upstream>(() =>
    Promise.resolve(Response.json({ success: true, result })),
  )
}

async function relay(call: Call, upstream = okUpstream()) {
  const response = await handleCfRelay(relayRequest(call), upstream)
  return { response, upstream, text: await response.text() }
}

const tokenBody = (patch: Record<string, unknown> = {}) => ({
  name: 'Photobooks · basov.photo',
  policies: [
    {
      effect: 'allow',
      permission_groups: [{ id: BUCKET_ITEM_WRITE_GROUP_ID }],
      resources: {
        [`com.cloudflare.edge.r2.bucket.${ACC}_default_${BUCKET}`]: '*',
      },
    },
  ],
  ...patch,
})

const policyWith = (patch: Record<string, unknown>) =>
  tokenBody({ policies: [{ ...tokenBody().policies[0], ...patch }] })

const corsBody = (allowed: Record<string, unknown> = {}) => ({
  rules: [
    {
      allowed: { origins: [ORIGIN], methods: ['PUT', 'GET'], ...allowed },
      maxAgeSeconds: 3600,
    },
  ],
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('handleCfRelay origin (R1)', () => {
  it.each([
    ['no Origin', { Origin: null }],
    ['another Origin', { Origin: 'https://evil.example' }],
    ['the Origin as http', { Origin: 'http://photobooks.example' }],
    ['no Sec-Fetch-Site', { 'Sec-Fetch-Site': null }],
    ['Sec-Fetch-Site same-site', { 'Sec-Fetch-Site': 'same-site' }],
    ['Sec-Fetch-Site cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
    ['Sec-Fetch-Site none', { 'Sec-Fetch-Site': 'none' }],
  ])('rejects %s with 403 and no upstream call', async (_, headers) => {
    const { response, upstream } = await relay({ path: '/accounts', headers })
    expect(response.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('handleCfRelay allowlist (R1)', () => {
  it.each([
    ['GET', '/user/tokens/verify'],
    ['GET', '/accounts'],
    ['GET', '/zones'],
    ['GET', `/accounts/${ACC}/r2/buckets`],
    ['GET', `/accounts/${ACC}/r2/buckets/${BUCKET}/domains/custom`],
    ['GET', '/user/tokens/permission_groups'],
  ])(
    'forwards %s %s with only the Authorization header',
    async (method, path) => {
      const { response, upstream } = await relay({
        method,
        path,
        headers: { Cookie: 'a=b', 'X-Forwarded-For': '1.2.3.4' },
      })
      expect(response.status).toBe(200)
      expect(upstream.mock.calls).toStrictEqual([
        [
          `${CF_API}${path}`,
          { method, headers: { Authorization: AUTH }, redirect: 'manual' },
        ],
      ])
    },
  )

  it.each([
    ['POST', '/accounts'],
    ['DELETE', `/accounts/${ACC}/r2/buckets/${BUCKET}/cors`],
    ['PATCH', '/user/tokens/verify'],
    ['HEAD', '/accounts'],
    ['OPTIONS', '/accounts'],
    ['GET', '/user/tokens'],
    ['GET', '/accounts/'],
    ['GET', `/accounts/${ACC}`],
    ['GET', `/accounts/${ACC.toUpperCase()}/r2/buckets`],
    ['GET', `/accounts/${ACC.slice(1)}/r2/buckets`],
    ['GET', `/accounts/${ACC}/r2/buckets/Upper/domains/custom`],
    ['GET', `/accounts/${ACC}/r2/buckets/-dash/domains/custom`],
    ['GET', `/accounts/${ACC}/r2/buckets/ab/domains/custom`],
    ['GET', `/accounts/${ACC}/r2/buckets/${'a'.repeat(64)}/domains/custom`],
    ['GET', `/accounts/${ACC}/r2/buckets/${BUCKET}/objects`],
    ['GET', '/accounts%2F'],
    ['GET', `/accounts/${ACC}/workers/scripts`],
    ['DELETE', `/user/tokens/${TOKEN_ID}x`],
    ['GET', '/accounts?per_page=50'],
    ['GET', '/zones?name=example.com'],
    ['GET', `/zones?account.id=${ACC}&account.id=${ZONE}`],
    ['GET', '/zones?per_page=0'],
    ['GET', '/zones?status=active;x'],
  ])('answers %s %s with 404 and no upstream call', async (method, path) => {
    const { response, upstream, text } = await relay({ method, path })
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(text).toBe('{"success":false,"errors":[{"code":"relay_not_found"}]}')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects a path outside the relay prefix', async () => {
    const upstream = okUpstream()
    const request = new Request(`${ORIGIN}/api/xy/accounts`, {
      headers: {
        Origin: ORIGIN,
        'Sec-Fetch-Site': 'same-origin',
        Authorization: AUTH,
      },
    })
    const response = await handleCfRelay(request, upstream)
    expect(response.status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('forwards the four zones query keys, rebuilt', async () => {
    const query = `account.id=${ACC}&status=active&per_page=50&page=2`
    const { upstream } = await relay({ path: `/zones?${query}` })
    expect(upstream.mock.calls[0]?.[0]).toBe(`${CF_API}/zones?${query}`)
  })

  it.each([
    ['no Authorization', { Authorization: null }],
    ['a non-Bearer scheme', { Authorization: `Basic ${TOKEN}` }],
    ['a short token', { Authorization: 'Bearer abc' }],
    ['a token with spaces', { Authorization: `${AUTH} extra` }],
  ])('answers %s with 401 and no upstream call', async (_, headers) => {
    const { response, upstream } = await relay({ path: '/accounts', headers })
    expect(response.status).toBe(401)
    expect(upstream).not.toHaveBeenCalled()
  })
})

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
]

/** The Spec's allowlist, written independently of the relay's table. */
const SPEC_ALLOWLIST: readonly (readonly [string, RegExp])[] = [
  ['GET', /^\/user\/tokens\/verify$/],
  ['GET', /^\/accounts$/],
  ['GET', /^\/zones$/],
  ['GET', /^\/accounts\/[0-9a-f]{32}\/r2\/buckets$/],
  ['POST', /^\/accounts\/[0-9a-f]{32}\/r2\/buckets$/],
  [
    'PUT',
    /^\/accounts\/[0-9a-f]{32}\/r2\/buckets\/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\/cors$/,
  ],
  [
    'GET',
    /^\/accounts\/[0-9a-f]{32}\/r2\/buckets\/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\/domains\/custom$/,
  ],
  [
    'POST',
    /^\/accounts\/[0-9a-f]{32}\/r2\/buckets\/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\/domains\/custom$/,
  ],
  ['GET', /^\/user\/tokens\/permission_groups$/],
  ['POST', /^\/user\/tokens$/],
  ['DELETE', /^\/user\/tokens\/[0-9a-f]{32}$/],
]

function specAllows(method: string, path: string): boolean {
  const { pathname } = new URL(`${ORIGIN}/api/cf${path}`)
  const rest = pathname.replace(/^\/api\/cf(?=\/)/, '')
  return (
    rest !== pathname &&
    SPEC_ALLOWLIST.some(([m, re]) => m === method && re.test(rest))
  )
}

const segment = fc.oneof(
  fc.constantFrom(
    'accounts',
    'user',
    'tokens',
    'verify',
    'zones',
    'r2',
    'buckets',
    'cors',
    'domains',
    'custom',
    'permission_groups',
    'workers',
    ACC,
    ZONE,
    TOKEN_ID,
    BUCKET,
    '..',
    '.',
    '',
  ),
  fc.string({ maxLength: 12 }).map(encodeURIComponent),
)
const randomPath = fc
  .array(segment, { minLength: 1, maxLength: 7 })
  .map((parts) => `/${parts.join('/')}`)

describe('handleCfRelay is not an open proxy (R3 PBT)', () => {
  test.prop([fc.constantFrom(...HTTP_METHODS), randomPath])(
    'never calls upstream for a method + path off the Spec allowlist',
    async (method, path) => {
      fc.pre(!specAllows(method, path))
      const body = ['GET', 'HEAD'].includes(method) ? undefined : '{}'
      const { response, upstream } = await relay({
        method,
        path,
        ...(body === undefined ? {} : { body }),
      })
      expect(response.status).toBe(404)
      expect(upstream).not.toHaveBeenCalled()
    },
  )

  test.prop([randomPath])(
    'forwards a GET exactly when the Spec allows it, to the same path',
    async (path) => {
      const { upstream } = await relay({ path })
      const expected = specAllows('GET', path)
        ? [new URL(`${ORIGIN}/api/cf${path}`).pathname.slice('/api/cf'.length)]
        : []
      expect(
        upstream.mock.calls.map(([url]) => url.slice(CF_API.length)),
      ).toEqual(expected)
    },
  )

  test.prop([
    fc.constantFrom(...SPEC_ALLOWLIST.map(([method]) => method)),
    fc.webUrl().map((url) => new URL(url).origin),
    fc.constantFrom('same-origin', 'same-site', 'cross-site', 'none'),
  ])(
    'never calls upstream for a foreign origin or fetch site',
    async (method, origin, site) => {
      fc.pre(origin !== ORIGIN || site !== 'same-origin')
      const { response, upstream } = await relay({
        method,
        path: '/accounts',
        headers: { Origin: origin, 'Sec-Fetch-Site': site },
      })
      expect(response.status).toBe(403)
      expect(upstream).not.toHaveBeenCalled()
    },
  )
})

describe('handleCfRelay bodies (R2)', () => {
  const post = (path: string, body: unknown, method = 'POST') =>
    relay({ method, path, body: JSON.stringify(body) })

  it('forwards a bucket-scoped token request, re-serialized as JSON', async () => {
    const { response, upstream } = await post('/user/tokens', tokenBody())
    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledWith(`${CF_API}/user/tokens`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      redirect: 'manual',
      body: JSON.stringify(tokenBody()),
    })
  })

  it('forwards the last value of a duplicate key, as checked', async () => {
    const raw = `{"name":"${'x'.repeat(200)}",${JSON.stringify(tokenBody()).slice(1)}`
    const { upstream } = await relay({
      method: 'POST',
      path: '/user/tokens',
      body: raw,
    })
    expect(upstream.mock.calls[0]?.[1].body).toBe(JSON.stringify(tokenBody()))
  })

  const resourceKey = `com.cloudflare.edge.r2.bucket.${ACC}_default_${BUCKET}`
  it.each([
    [
      'two policies',
      tokenBody({
        policies: [...tokenBody().policies, ...tokenBody().policies],
      }),
    ],
    ['no policy', tokenBody({ policies: [] })],
    ['a deny policy', policyWith({ effect: 'deny' })],
    [
      'a second permission group',
      policyWith({
        permission_groups: [{ id: BUCKET_ITEM_WRITE_GROUP_ID }, { id: ZONE }],
      }),
    ],
    [
      'another permission group',
      policyWith({ permission_groups: [{ id: ZONE }] }),
    ],
    [
      'a group with extra keys',
      policyWith({
        permission_groups: [{ id: BUCKET_ITEM_WRITE_GROUP_ID, name: 'x' }],
      }),
    ],
    [
      'an account-wide resource',
      policyWith({ resources: { [`com.cloudflare.api.account.${ACC}`]: '*' } }),
    ],
    [
      'an all-buckets resource',
      policyWith({
        resources: { [`com.cloudflare.edge.r2.bucket.${ACC}_default_*`]: '*' },
      }),
    ],
    [
      'two resources',
      policyWith({
        resources: {
          [resourceKey]: '*',
          [`com.cloudflare.edge.r2.bucket.${ACC}_default_other`]: '*',
        },
      }),
    ],
    [
      'a nested resource value',
      policyWith({ resources: { [resourceKey]: { '*': '*' } } }),
    ],
    [
      'a policy condition',
      policyWith({ condition: { request_ip: { in: ['0.0.0.0/0'] } } }),
    ],
    [
      'a token condition',
      tokenBody({ condition: { request_ip: { in: ['0.0.0.0/0'] } } }),
    ],
    ['an expiry key', tokenBody({ expires_on: '2030-01-01T00:00:00Z' })],
    ['a 121-character name', tokenBody({ name: 'n'.repeat(121) })],
    ['an empty name', tokenBody({ name: '' })],
    ['a non-string name', tokenBody({ name: ['n'] })],
    ['an array body', [tokenBody()]],
    ['a null body', null],
    ['null resources', policyWith({ resources: null })],
    ['no resources', policyWith({ resources: {} })],
    ['an array of resources', policyWith({ resources: ['*'] })],
  ])('rejects a token request with %s (403)', async (_, body) => {
    const { response, upstream } = await post('/user/tokens', body)
    expect(response.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('accepts a 120-character token name', async () => {
    const { response } = await post(
      '/user/tokens',
      tokenBody({ name: 'n'.repeat(120) }),
    )
    expect(response.status).toBe(200)
  })

  const corsPath = `/accounts/${ACC}/r2/buckets/${BUCKET}/cors`
  it('forwards a CORS policy for exactly the request origin', async () => {
    const body = corsBody({ headers: ['content-type', 'x-amz-*'] })
    const { response, upstream } = await post(
      corsPath,
      {
        rules: [{ ...body.rules[0], id: 'editor', exposeHeaders: ['ETag'] }],
      },
      'PUT',
    )
    expect(response.status).toBe(200)
    expect(upstream.mock.calls[0]?.[1].method).toBe('PUT')
  })

  const rule = corsBody().rules[0]
  it.each([
    [
      'the bare minimum',
      { rules: [{ allowed: { origins: [ORIGIN], methods: ['PUT'] } }] },
    ],
    ['four rules', { rules: [rule, rule, rule, rule] }],
    ['a zero max age', { rules: [{ ...rule, maxAgeSeconds: 0 }] }],
    ['a one-day max age', { rules: [{ ...rule, maxAgeSeconds: 86_400 }] }],
    [
      '20 headers',
      corsBody({
        headers: Array.from({ length: 20 }, (_, i) => `h${String(i)}`),
      }),
    ],
  ])('accepts a CORS policy with %s', async (_, body) => {
    const { response } = await post(corsPath, body, 'PUT')
    expect(response.status).toBe(200)
  })

  it.each([
    ['another origin', corsBody({ origins: ['https://evil.example'] })],
    ['a wildcard origin', corsBody({ origins: ['*'] })],
    ['two origins', corsBody({ origins: [ORIGIN, 'https://evil.example'] })],
    ['no origins', corsBody({ origins: [] })],
    ['an unknown method', corsBody({ methods: ['PATCH'] })],
    ['one unknown method', corsBody({ methods: ['GET', 'PATCH'] })],
    ['one bad header', corsBody({ headers: ['content-type', 'a b'] })],
    [
      '21 headers',
      corsBody({
        headers: Array.from({ length: 21 }, (_, i) => `h${String(i)}`),
      }),
    ],
    ['a header string', corsBody({ headers: 'content-type' })],
    ['a numeric rule id', { rules: [{ ...corsBody().rules[0], id: 123 }] }],
    ['one bad rule', { rules: [corsBody().rules[0], { allowed: {} }] }],
    ['a repeated method', corsBody({ methods: ['GET', 'GET'] })],
    ['no methods', corsBody({ methods: [] })],
    ['a bad header name', corsBody({ headers: ['a b'] })],
    ['an extra allowed key', corsBody({ credentials: true })],
    ['no rules', { rules: [] }],
    [
      'five rules',
      { rules: Array.from({ length: 5 }, () => corsBody().rules[0]) },
    ],
    [
      'a negative max age',
      { rules: [{ ...corsBody().rules[0], maxAgeSeconds: -1 }] },
    ],
    [
      'a max age over a day',
      { rules: [{ ...corsBody().rules[0], maxAgeSeconds: 86_401 }] },
    ],
    ['a bad rule id', { rules: [{ ...corsBody().rules[0], id: 'a/b' }] }],
    [
      'a bad exposed header',
      { rules: [{ ...corsBody().rules[0], exposeHeaders: [1] }] },
    ],
    ['an extra rule key', { rules: [{ ...corsBody().rules[0], extra: 1 }] }],
    ['an extra top-level key', { ...corsBody(), extra: 1 }],
  ])('rejects a CORS policy with %s (403)', async (_, body) => {
    const { response, upstream } = await post(corsPath, body, 'PUT')
    expect(response.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })

  const bucketsPath = `/accounts/${ACC}/r2/buckets`
  it.each([
    [{ name: BUCKET }, 200],
    [{ name: BUCKET, locationHint: 'weur', storageClass: 'Standard' }, 200],
    [{ name: 'Bad_Name' }, 403],
    [{ name: [BUCKET] }, 403],
    [{ name: BUCKET, locationHint: 'mars' }, 403],
    [{ name: BUCKET, storageClass: 'Glacier' }, 403],
    [{ name: BUCKET, jurisdiction: 'eu' }, 403],
    [{}, 403],
  ])('bucket body %j → %i', async (body, status) => {
    const { response } = await post(bucketsPath, body)
    expect(response.status).toBe(status)
  })

  const domainsPath = `/accounts/${ACC}/r2/buckets/${BUCKET}/domains/custom`
  const domain = { domain: 'books.basov.photo', zoneId: ZONE, enabled: true }
  it.each([
    [domain, 200],
    [{ ...domain, minTLS: '1.2' }, 200],
    [{ ...domain, minTLS: '0.9' }, 403],
    [{ ...domain, domain: 'localhost' }, 403],
    [{ ...domain, domain: 'a..example.com' }, 403],
    [{ ...domain, domain: '-a.example.com' }, 403],
    [{ ...domain, domain: 'a.example.c0m' }, 403],
    [{ ...domain, domain: `${'a.'.repeat(126)}com` }, 403],
    [{ ...domain, domain: 7 }, 403],
    [{ ...domain, zoneId: 'zone' }, 403],
    [{ ...domain, zoneId: 7 }, 403],
    [{ ...domain, zoneId: [ZONE] }, 403],
    [
      {
        ...domain,
        domain: `${'a'.repeat(63)}.`.repeat(3) + `${'a'.repeat(57)}.com`,
      },
      200,
    ],
    [
      {
        ...domain,
        domain: `${'a'.repeat(63)}.`.repeat(3) + `${'a'.repeat(58)}.com`,
      },
      403,
    ],
    [{ ...domain, enabled: 'yes' }, 403],
    [{ ...domain, extra: 1 }, 403],
  ])('custom domain body %j → %i', async (body, status) => {
    const { response } = await post(domainsPath, body)
    expect(response.status).toBe(status)
  })

  it.each([
    ['no Content-Type', { 'Content-Type': null }, '{}', 415],
    ['a text Content-Type', { 'Content-Type': 'text/plain' }, '{}', 415],
    [
      'a JSON-like Content-Type',
      { 'Content-Type': 'application/jsonx' },
      '{}',
      415,
    ],
    ['bad JSON', {}, '{"name":', 400],
    ['non-UTF-8 bytes in a JSON string', {}, '�', 400],
    ['a body over 16 KB', {}, `"${'x'.repeat(MAX_BODY_BYTES - 1)}"`, 413],
    ['a body of exactly 16 KB', {}, `"${'x'.repeat(MAX_BODY_BYTES - 2)}"`, 403],
  ])(
    'answers a token request with %s → %i',
    async (_, headers, body, status) => {
      const request = relayRequest({
        method: 'POST',
        path: '/user/tokens',
        body,
        headers,
      })
      // `"\xff"`: a lenient decoder would read a valid JSON string.
      const bytes = body === '�' ? new Uint8Array([0x22, 0xff, 0x22]) : body
      const upstream = okUpstream()
      const response = await handleCfRelay(
        new Request(request, { body: bytes }),
        upstream,
      )
      expect(response.status).toBe(status)
      expect(upstream).not.toHaveBeenCalled()
    },
  )

  it('accepts a JSON Content-Type with a charset', async () => {
    const { response } = await relay({
      method: 'POST',
      path: '/user/tokens',
      body: JSON.stringify(tokenBody()),
      headers: { 'Content-Type': 'Application/JSON ; charset=utf-8' },
    })
    expect(response.status).toBe(200)
  })

  it('answers a bodiless POST with 400', async () => {
    const upstream = okUpstream()
    const request = relayRequest({
      method: 'POST',
      path: '/user/tokens',
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await handleCfRelay(request, upstream)
    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('handleCfRelay token delete (R1)', () => {
  const path = `/user/tokens/${TOKEN_ID}`

  it('deletes the token its own verify call names', async () => {
    const { response, upstream } = await relay({ method: 'DELETE', path })
    expect(response.status).toBe(200)
    expect(
      upstream.mock.calls.map(([url, init]) => [init.method, url]),
    ).toEqual([
      ['GET', VERIFY_URL],
      ['DELETE', `${CF_API}${path}`],
    ])
    expect(upstream.mock.calls[0]?.[1].headers).toEqual({ Authorization: AUTH })
  })

  it.each([
    ['another token id', okUpstream({ id: ZONE })],
    ['no result', okUpstream(null)],
    [
      'a failed verify',
      vi.fn<Upstream>(() =>
        Promise.resolve(
          Response.json({ result: { id: TOKEN_ID } }, { status: 401 }),
        ),
      ),
    ],
  ])('refuses with %s (403, verify only)', async (_, upstream) => {
    const { response } = await relay({ method: 'DELETE', path }, upstream)
    expect(response.status).toBe(403)
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([VERIFY_URL])
  })
})

describe('handleCfRelay responses (R2, R3)', () => {
  it('keeps status and body but drops cookies, cf-* and other headers', async () => {
    const upstream = vi.fn<Upstream>(() =>
      Promise.resolve(
        new Response('{"success":false}', {
          status: 403,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': '__cf_bm=1; Secure',
            'CF-Ray': '8f00',
            'cf-cache-status': 'HIT',
            'Cache-Control': 'public, max-age=60',
            Server: 'cloudflare',
          },
        }),
      ),
    )
    const { response, text } = await relay({ path: '/accounts' }, upstream)
    expect(response.status).toBe(403)
    expect(text).toBe('{"success":false}')
    expect([...response.headers]).toEqual([
      ['cache-control', 'no-store'],
      ['content-type', 'application/json; charset=utf-8'],
      ['x-content-type-options', 'nosniff'],
    ])
  })

  it('labels a non-JSON upstream body as plain text', async () => {
    const upstream = vi.fn<Upstream>(() =>
      Promise.resolve(
        new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
      ),
    )
    const { response } = await relay({ path: '/accounts' }, upstream)
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    )
  })

  it('returns an upstream redirect unfollowed, without its Location', async () => {
    const upstream = vi.fn<Upstream>(() =>
      Promise.resolve(
        new Response('{}', {
          status: 302,
          headers: { Location: 'https://evil.example/' },
        }),
      ),
    )
    const { response } = await relay({ path: '/accounts' }, upstream)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBeNull()
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('passes a 204 through without a body', async () => {
    const upstream = vi.fn<Upstream>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    )
    const { response, text } = await relay({ path: '/accounts' }, upstream)
    expect(response.status).toBe(204)
    expect(text).toBe('')
  })

  it('answers an upstream failure with 502 and echoes nothing', async () => {
    const upstream = vi.fn<Upstream>(() =>
      Promise.reject(new Error(`failed with ${AUTH}`)),
    )
    const { response, text } = await relay({ path: '/accounts' }, upstream)
    expect(response.status).toBe(502)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(text).toBe(
      '{"success":false,"errors":[{"code":"relay_upstream_failed"}]}',
    )
  })

  it('never echoes the token in a relay error', async () => {
    const statuses = await Promise.all(
      [
        { path: '/accounts', headers: { Origin: null } },
        { path: '/nope' },
        { path: '/user/tokens', method: 'POST', body: '{}' },
      ].map(async (call) => {
        const { response, text } = await relay(call)
        expect(text).not.toContain(TOKEN)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        return response.status
      }),
    )
    expect(statuses).toEqual([403, 404, 403])
  })
})

describe('worker entry', () => {
  const env = {
    ASSETS: { fetch: vi.fn(() => Promise.resolve(new Response('asset'))) },
  }

  it('serves non-relay paths from assets', async () => {
    const response = await worker.fetch(new Request(`${ORIGIN}/api/cfx`), env)
    expect(await response.text()).toBe('asset')
  })

  it('relays /api/cf/* through the global fetch', async () => {
    const fetchStub = vi.fn(() => Promise.resolve(Response.json({ ok: 1 })))
    vi.stubGlobal('fetch', fetchStub)
    const response = await worker.fetch(
      relayRequest({ path: '/accounts' }),
      env,
    )
    expect(response.status).toBe(200)
    expect(fetchStub).toHaveBeenCalledWith(`${CF_API}/accounts`, {
      method: 'GET',
      headers: { Authorization: AUTH },
      redirect: 'manual',
    })
  })
})
