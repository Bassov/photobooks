import type { Locator, Page, Route } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Designer parity connect-own-hosting (M116, M118, M119): ghost buttons take
// the kit's inherited ink, the primary hover is --primary-hover, and a small
// dot badge has the kit's 4 px left padding. The relay (`/api/cf/*`) and R2
// are answered here; nothing reaches Cloudflare.

const INK = [57, 55, 56]
const MUTED = [83, 81, 82]
const HOVER = [58, 56, 57]
const TOKEN = `e2e${'Ab'.repeat(20)}`
const ACCOUNT = '0123456789abcdef0123456789abcdef'
const R2 = 'https://*.r2.cloudflarestorage.com/**'
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, PUT, DELETE',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'ETag',
}

const ok = (result: unknown) => ({
  contentType: 'application/json',
  body: JSON.stringify({ success: true, errors: [], result }),
})
const fail = (status: number, code: number) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ success: false, errors: [{ code }], result: null }),
})

/** Relay + R2 stub: `r2Off` fails the bucket list, `dnsTaken` the domain. */
async function routeCloudflare(
  page: Page,
  cf: { r2Off: boolean; dnsTaken: boolean },
) {
  const answer = (
    method: string,
    path: string,
    body: Record<string, unknown>,
  ) => {
    const parts = path.split('/').slice(1)
    if (path === '/user/tokens/verify')
      return ok({ id: 'f'.repeat(32), status: 'active' })
    if (path === '/accounts')
      return ok([{ id: ACCOUNT, name: 'Aleksandr Basov' }])
    if (path === '/zones')
      return ok([{ id: 'z1', name: 'basov.photo', status: 'active' }])
    if (path === '/user/tokens/permission_groups') {
      return ok([{ id: 'grp', name: 'Workers R2 Storage Bucket Item Write' }])
    }
    if (path === '/user/tokens' && method === 'POST') {
      return ok({ id: 'a'.repeat(32), value: 'bucketKeyValue'.padEnd(40, 'x') })
    }
    if (parts[0] === 'user' && method === 'DELETE') return ok({ id: parts[2] })
    const rest = parts.slice(4).join('/')
    if (parts.length === 4 && method === 'GET') {
      return cf.r2Off ? fail(403, 10042) : ok({ buckets: [] })
    }
    if (parts.length === 4) return ok({ name: body.name })
    if (rest.endsWith('/cors')) return ok({})
    if (rest.endsWith('/domains/custom') && method === 'GET')
      return ok({ domains: [] })
    if (rest.endsWith('/domains/custom')) {
      return cf.dnsTaken
        ? fail(409, 100117)
        : ok({ domain: body.domain, enabled: true })
    }
    return fail(404, 7003)
  }
  await page.route('**/api/cf/**', async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.slice('/api/cf'.length)
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>
    await route.fulfill(answer(request.method(), path, body))
  })
  await page.route(R2, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: CORS,
      body: '',
    }),
  )
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

/** Darkest painted pixel in the box: the text ink of a light button. */
async function ink(button: Locator): Promise<number[]> {
  await button.page().mouse.move(0, 0)
  const b = await button.boundingBox()
  if (b === null) throw new Error('not visible')
  const points = Array.from(
    { length: Math.floor(b.width - 2) * Math.floor(b.height - 2) },
    (_, i) => ({
      x: 1 + (i % Math.floor(b.width - 2)),
      y: 1 + Math.floor(i / Math.floor(b.width - 2)),
    }),
  )
  const px = await pixelsAt(button, points)
  const sum = (c: number[]) => (c[0] ?? 0) + (c[1] ?? 0) + (c[2] ?? 0)
  return px.reduce((a, c) => (sum(c) < sum(a) ? c : a)).slice(0, 3)
}

function near(actual: number[], want: number[], tol = 2) {
  expect(actual.length).toBe(3)
  actual.forEach((v, k) => {
    expect(
      Math.abs(v - (want[k] ?? 0)),
      `${actual.join()} vs ${want.join()}`,
    ).toBeLessThanOrEqual(tol)
  })
}

async function expectInk(button: Locator, want: number[]) {
  await expect(button).toBeVisible()
  await expect(button).toHaveCSS('color', `rgb(${want.join(', ')})`)
  near(await ink(button), want)
}

/** Hover paint: the background left of the label, clear of the text. */
async function expectHover(button: Locator) {
  await expect(button).toBeEnabled()
  await button.hover()
  await expect(button).toHaveCSS('background-color', `rgb(${HOVER.join(', ')})`)
  const b = await button.boundingBox()
  if (b === null) throw new Error('not visible')
  const [px = []] = await pixelsAt(button, [{ x: 3, y: b.height / 2 }])
  near(px.slice(0, 3), HOVER)
}

test('Hosting ghosts paint the kit ink; Set up hosting hovers --primary-hover', async ({
  page,
}) => {
  const cf = { r2Off: true, dnsTaken: true }
  await routeCloudflare(page, cf)
  await openHosting(page)
  await page.getByTestId('hosting-setup-token').fill(TOKEN)
  await page.getByTestId('hosting-setup-continue').click()
  await expect(page.getByTestId('hosting-setup-box')).toContainText('R2 is off')
  await expectInk(page.getByTestId('hosting-setup-recheck'), INK)

  cf.r2Off = false
  await page.getByTestId('hosting-setup-recheck').click()
  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expectHover(page.getByTestId('hosting-setup-run'))

  await page.getByTestId('hosting-setup-run').click()
  await expect(page.getByTestId('hosting-setup-row-error')).toBeVisible()
  await expectInk(page.getByTestId('hosting-setup-cancel'), INK)
})

test('connected: dot badge has the kit 4 px left padding; Forget paints the kit ink', async ({
  page,
}) => {
  await routeCloudflare(page, { r2Off: false, dnsTaken: false })
  await openHosting(page)
  await toAddress(page)
  await page.getByTestId('hosting-setup-run').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()

  const badge = page.getByTestId('hosting-badge')
  await expect(badge).toHaveText('Connected')
  await expect(badge).toHaveCSS('padding-left', '4px')
  await expect(badge).toHaveCSS('padding-right', '6px')
  const b = await badge.boundingBox()
  expect(Math.abs((b?.width ?? 0) - 77.66)).toBeLessThanOrEqual(0.5)
  // The dot paints right at the new padding edge (5 px wide from x 4).
  const [dot = [], gap = []] = await pixelsAt(badge, [
    { x: 6.5, y: (b?.height ?? 0) / 2 },
    { x: 1, y: (b?.height ?? 0) / 2 },
  ])
  expect(dot.slice(0, 3)).not.toEqual(gap.slice(0, 3))

  await expectInk(page.getByTestId('hosting-forget'), INK)
})

test('kit-muted zoom menu stays muted; plain Default badge keeps its box', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?fixture=painter&printProfiles=kit&px=4000')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await expectInk(page.getByTestId('zoom-menu'), MUTED)

  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-print').click()
  await expect(page.locator('h1')).toHaveText('Print presets')
  const plain = page.locator('.pb-badge', { hasText: 'Default' })
  await expect(plain).toHaveCSS('padding-left', '6px')
  await expect(plain).toHaveCSS('padding-right', '6px')
  const box = await plain.boundingBox()
  // Box measured before this change (M101 keeps it): 50.78 × 20.
  expect(Math.abs((box?.width ?? 0) - 50.78)).toBeLessThanOrEqual(0.5)
  expect(box?.height).toBe(20)
})

test('Create book primary hovers --primary-hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) throw new Error(attached.code ?? 'attach')
    const created = await api.createBookInLibrary()
    if (!created.ok) throw new Error(created.code ?? 'create')
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('new-book').first().click()
  const dialog = page.getByTestId('create-book-dialog')
  await expect(dialog).toBeVisible()
  await page.getByTestId('create-title').fill('Lake trip')
  await expectHover(dialog.getByTestId('create-book'))
})
