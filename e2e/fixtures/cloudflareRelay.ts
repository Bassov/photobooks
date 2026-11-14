import type { Page, Route } from '@playwright/test'

// connect-own-hosting: the relay (`/api/cf/*`) and R2 answered with
// `page.route`; nothing reaches Cloudflare.

export const TOKEN = `e2e${'Ab'.repeat(20)}`
const ACCOUNT = '0123456789abcdef0123456789abcdef'
const R2 = 'https://*.r2.cloudflarestorage.com/**'

export interface Cf {
  /** `METHOD path` of every relay call, in order. */
  calls: string[]
  r2Off: boolean
  zones: { id: string; name: string; status: string }[]
  dnsTaken: boolean
  deleteFails: boolean
  /** Hold token verify until `release()`. */
  hold: boolean
  release: () => void
}

const ok = (result: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, errors: [], result }),
})
const fail = (status: number, code: number) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    success: false,
    errors: [{ code, message: 'nope' }],
    result: null,
  }),
})

export async function routeCloudflare(page: Page): Promise<Cf> {
  const held: (() => void)[] = []
  const cf: Cf = {
    calls: [],
    r2Off: false,
    zones: [
      { id: 'z1', name: 'basov.photo', status: 'active' },
      { id: 'z2', name: 'mybooks.org', status: 'pending' },
    ],
    dnsTaken: false,
    deleteFails: false,
    hold: false,
    release: () => {
      cf.hold = false
      for (const resolve of held.splice(0)) resolve()
    },
  }
  const buckets: string[] = []
  const answer = (method: string, url: URL, body: Record<string, unknown>) => {
    const path = url.pathname.slice('/api/cf'.length)
    const parts = path.split('/').slice(1)
    if (path === '/user/tokens/verify') {
      return ok({ id: 'f'.repeat(32), status: 'active' })
    }
    if (path === '/accounts')
      return ok([{ id: ACCOUNT, name: 'Aleksandr Basov' }])
    if (path === '/zones') return ok(cf.zones)
    if (path === '/user/tokens/permission_groups') {
      return ok([{ id: 'grp', name: 'Workers R2 Storage Bucket Item Write' }])
    }
    if (path === '/user/tokens' && method === 'POST') {
      return ok(
        { id: 'a'.repeat(32), value: 'bucketKeyValue'.padEnd(40, 'x') },
        201,
      )
    }
    if (parts[0] === 'user' && method === 'DELETE') {
      return cf.deleteFails ? fail(500, 1) : ok({ id: parts[2] })
    }
    const rest = parts.slice(4).join('/')
    if (parts.length === 4 && method === 'GET') {
      return cf.r2Off
        ? fail(403, 10042)
        : ok({ buckets: buckets.map((name) => ({ name })) })
    }
    if (parts.length === 4 && method === 'POST') {
      buckets.push(String(body.name))
      return ok({ name: body.name })
    }
    if (rest.endsWith('/cors')) return ok({})
    if (rest.endsWith('/domains/custom') && method === 'GET') {
      return ok({ domains: [] })
    }
    if (rest.endsWith('/domains/custom')) {
      return cf.dnsTaken
        ? fail(409, 100117)
        : ok({ domain: body.domain, enabled: true })
    }
    return fail(404, 7003)
  }
  await page.route('**/api/cf/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    cf.calls.push(`${request.method()} ${url.pathname.slice('/api/cf'.length)}`)
    if (cf.hold && url.pathname.endsWith('/verify')) {
      await new Promise<void>((resolve) => held.push(resolve))
    }
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>
    await route.fulfill(answer(request.method(), url, body))
  })
  await page.route(R2, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, HEAD, PUT, DELETE',
        'access-control-allow-headers': '*',
        'access-control-expose-headers': 'ETag',
      },
      body: '',
    }),
  )
  return cf
}
