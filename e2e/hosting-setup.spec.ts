import type { Locator, Page, Route } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

// connect-own-hosting: Settings → Hosting guided setup in prod. The relay
// (`/api/cf/*`) and R2 are answered here (`page.route`); nothing reaches
// Cloudflare. Numbers mirror e2e/kit-hosting-settings.spec.ts KS1–KS2.

const TOKEN = `e2e${'Ab'.repeat(20)}`
const ACCOUNT = '0123456789abcdef0123456789abcdef'
const HOST = 'books.basov.photo'
const R2 = 'https://*.r2.cloudflarestorage.com/**'

interface Cf {
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

async function routeCloudflare(page: Page): Promise<Cf> {
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

async function openHosting(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?perf=1')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('go-library')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-hosting').click()
  await expect(page.getByTestId('hosting-setup')).toBeVisible()
}

async function toAddress(page: Page) {
  await page.getByTestId('hosting-setup-token').fill(TOKEN)
  await page.getByTestId('hosting-setup-continue').click()
  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

const near = (a: number, b: number) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(
    0.5,
  )
}

const rgbAt = async (l: Locator, x: number, y: number) =>
  (await pixelsAt(l, [{ x, y }]))[0] ?? []

const near3 = (a: number[], b: number[], d = 8) => {
  for (const k of [0, 1, 2]) {
    expect(
      Math.abs((a[k] ?? 0) - (b[k] ?? 0)),
      `${a.join()} ≈ ${b.join()}`,
    ).toBeLessThanOrEqual(d)
  }
}

/** Some pixel of the box paints the Spec error red (#a8403a). */
async function paintsRed(l: Locator) {
  const b = await box(l)
  const points = Array.from(
    { length: Math.floor(Math.min(b.width, 80)) * Math.floor(b.height) },
    (_, i) => ({ x: i % 80, y: Math.floor(i / 80) }),
  ).filter((p) => p.x < b.width - 1 && p.y < b.height - 1)
  const pixels = await pixelsAt(l, points)
  return pixels.some(([r = 0, g = 0, bl = 0]) => r > 140 && g < 100 && bl < 100)
}

const row = (page: Page, n: number) =>
  page.getByTestId(`hosting-setup-row-${String(n)}`)

async function noTokenLeft(page: Page) {
  const html = await page.evaluate(() => document.documentElement.outerHTML)
  const storage = await page.evaluate(() =>
    Object.keys(localStorage)
      .map((key) => `${key}=${localStorage.getItem(key) ?? ''}`)
      .join('\n'),
  )
  expect(html).not.toContain(TOKEN)
  expect(storage).not.toContain(TOKEN)
  expect(page.url()).not.toContain(TOKEN)
}

test('kit geometry and paint; Continue keeps its width through Checking…', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  await openHosting(page)
  const card = page.getByTestId('hosting-setup')
  await expect(page.getByTestId('hosting-form')).toBeHidden()
  near((await box(card)).width, 640)
  for (const n of [1, 2, 3]) {
    near((await box(page.getByTestId(`hosting-step-${String(n)}`))).height, 52)
    const marker = await box(page.getByTestId(`hosting-marker-${String(n)}`))
    near(marker.width, 20)
    near(marker.height, 20)
  }
  // current = #232223 disc, future = background with a ring
  const bg = await rgbAt(page.getByTestId('hosting-step-3'), 600, 4)
  near3(await rgbAt(page.getByTestId('hosting-marker-1'), 10, 3), [35, 34, 35])
  const future = page.getByTestId('hosting-marker-3')
  near3(await rgbAt(future, 10, 3), bg, 3)
  expect((bg[0] ?? 0) - ((await rgbAt(future, 10, 0))[0] ?? 0)).toBeGreaterThan(
    25,
  )

  const token = page.getByTestId('hosting-setup-token')
  near((await box(token.locator('..'))).height, 32)
  const go = page.getByTestId('hosting-setup-continue')
  await expect(go).toBeDisabled()
  await token.fill('not a token')
  await expect(page.locator('#hosting-setup-token-line')).toHaveText(
    "This doesn't look like a Cloudflare API token.",
  )
  await token.fill(TOKEN)
  const w = (await box(go)).width
  cf.hold = true
  await token.press('Enter')
  await expect(go).toHaveAccessibleName('Checking…')
  near((await box(go)).width, w)
  await expect(card).toHaveAttribute('aria-busy', 'true')
  cf.release()
  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
  // done = #D7D7D7 disc with a check
  near3(
    await rgbAt(page.getByTestId('hosting-marker-1'), 10, 3),
    [215, 215, 215],
  )
  await expect(page.getByTestId('hosting-step-1-summary')).toHaveText(
    'Aleksandr Basov',
  )
  const sub = page.getByTestId('hosting-setup-sub').locator('..')
  near((await box(sub)).height, 32)
  near((await box(sub)).width, 140)
  near((await box(page.getByTestId('hosting-setup-zone'))).height, 32)
  await expect(page.getByTestId('hosting-setup-token')).toHaveCount(0)
  await noTokenLeft(page)
})

test('happy path: six rows with zero LoAF, then the connected card', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  await openHosting(page)
  await toAddress(page)
  await expect(page.getByTestId('hosting-setup-host')).toContainText(HOST)

  await clearPerfScenario(page)
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  await page.getByTestId('hosting-setup-run').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  const rows = await page.evaluate(browserTakeLoafScripts)
  console.log(
    `hosting-setup: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)

  await expect(page.getByTestId('hosting-connected')).toContainText(
    'Set up automatically',
  )
  await expect(page.getByTestId('hosting-token-left')).toHaveCount(0)
  expect(cf.calls).toContain(`DELETE /user/tokens/${'f'.repeat(32)}`)
  await noTokenLeft(page)
})

test('R2 off: the box, then Check again moves on', async ({ page }) => {
  const cf = await routeCloudflare(page)
  cf.r2Off = true
  await openHosting(page)
  await page.getByTestId('hosting-setup-token').fill(TOKEN)
  await page.getByTestId('hosting-setup-continue').click()
  await expect(page.getByTestId('hosting-setup-box')).toContainText(
    'R2 is off in this account.',
  )
  cf.r2Off = false
  await page.getByTestId('hosting-setup-recheck').click()
  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
})

test('no active zone: the box names the pending one, Set up stays off', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  cf.zones = [{ id: 'z2', name: 'mybooks.org', status: 'pending' }]
  await openHosting(page)
  await toAddress(page)
  await expect(page.getByTestId('hosting-setup-box')).toContainText(
    'This account has no active domain yet.',
  )
  await expect(page.getByTestId('hosting-setup-pending')).toContainText(
    'mybooks.org',
  )
  await expect(page.getByTestId('hosting-setup-run')).toBeDisabled()
})

test('a DNS conflict fails row 3 in red; Try again resumes at row 3', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  cf.dnsTaken = true
  await openHosting(page)
  await toAddress(page)
  await page.getByTestId('hosting-setup-run').click()
  await expect(row(page, 3)).toHaveAttribute('data-state', 'failed')
  await expect(row(page, 1)).toHaveAttribute('data-state', 'done')
  await expect(row(page, 2)).toHaveAttribute('data-state', 'done')
  await expect(row(page, 4)).toHaveAttribute('data-state', 'pending')
  expect(await paintsRed(page.getByTestId('hosting-setup-row-3-text'))).toBe(
    true,
  )
  await expect(page.getByTestId('hosting-setup-row-error')).toBeVisible()

  cf.dnsTaken = false
  const before = cf.calls.length
  await page.getByTestId('hosting-setup-retry').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  const again = cf.calls.slice(before)
  // Rows 1–2 (create bucket, CORS) are not called again.
  expect(again.filter((call) => /\/r2\/buckets$|\/cors$/.test(call))).toEqual(
    [],
  )
  expect(again.some((call) => call.endsWith('/domains/custom'))).toBe(true)
  await noTokenLeft(page)
})

test('a setup token that cannot be deleted shows the API Tokens line', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  cf.deleteFails = true
  await openHosting(page)
  await toAddress(page)
  await page.getByTestId('hosting-setup-run').click()
  await expect(page.getByTestId('hosting-token-left')).toBeVisible()
  await expect(page.getByTestId('hosting-connected')).toContainText(
    'Set up automatically',
  )
  await noTokenLeft(page)
})
