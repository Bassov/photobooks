import type { Page, Route } from '@playwright/test'
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

// Designer publish-credentials: Settings → Hosting. Every request to the R2 S3
// endpoint is answered here (`page.route`); nothing reaches Cloudflare.

const ACCOUNT = '0f3a9c0f3a9c0f3a9c0f3a9c0f3a9c0f'
const KEY = '0000000000000000000000000000' + '9f2c'
const SECRET = '0'.repeat(60) + 'beef'
const R2 = 'https://*.r2.cloudflarestorage.com/**'

type Answer = 'ok' | 'cors' | 'hold'

/** Route R2: `ok` answers with open CORS, `cors` fails like a blocked fetch, `hold` waits for `release()`. */
async function routeR2(page: Page, answer: () => Answer) {
  const seen: { method: string; url: string }[] = []
  const held: (() => void)[] = []
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, PUT, DELETE',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag',
  }
  const reply = (route: Route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: cors,
      body: '',
    })
  await page.route(R2, async (route) => {
    const request = route.request()
    seen.push({ method: request.method(), url: request.url() })
    const mode = answer()
    if (mode === 'cors') {
      // A fulfilled response skips the CORS check; a blocked one is a
      // network error to the page, which `abort` reproduces.
      await route.abort('failed')
      return
    }
    if (mode === 'hold' && !released && request.method() !== 'OPTIONS') {
      await new Promise<void>((resolve) => held.push(resolve))
    }
    await reply(route)
  })
  let released = false
  return {
    seen,
    release: () => {
      released = true
      for (const resolve of held.splice(0)) resolve()
    },
  }
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
  await expect(page.locator('h1')).toHaveText('Hosting')
}

/** Not connected opens the guided setup; these tests use the manual form. */
async function openManual(page: Page) {
  await openHosting(page)
  await page.getByTestId('hosting-manual').click()
  await expect(page.getByTestId('hosting-form')).toBeVisible()
}

async function fill(page: Page, bucket = 'my-books') {
  await page.getByTestId('hosting-account').fill(ACCOUNT)
  await page.getByTestId('hosting-bucket').fill(bucket)
  await page.getByTestId('hosting-key').fill(KEY)
  await page.getByTestId('hosting-secret').fill(SECRET)
  await page.getByTestId('hosting-url').fill('books.example.com')
  await page.getByTestId('hosting-url').blur()
  await expect(page.getByTestId('hosting-url')).toHaveValue(
    'https://books.example.com',
  )
}

async function connect(page: Page) {
  await fill(page)
  await page.getByTestId('hosting-connect').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
}

/** Records in the `photobooks-secrets` store (credentials + status). */
function secretsCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('photobooks-secrets', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('r2')
        open.onerror = () => {
          reject(new Error('open'))
        }
        open.onsuccess = () => {
          const count = open.result.transaction('r2').objectStore('r2').count()
          count.onsuccess = () => {
            open.result.close()
            resolve(count.result)
          }
        }
      }),
  )
}

test('Connect checks, saves with zero LoAF, survives a reload and never shows the secret', async ({
  page,
}) => {
  const logs: string[] = []
  page.on('console', (message) => logs.push(message.text()))
  const r2 = await routeR2(page, () => 'ok')
  await openManual(page)
  await expect(page.getByTestId('hosting-connect')).toBeDisabled()
  expect(r2.seen).toEqual([])
  await fill(page)
  await expect(page.getByTestId('hosting-connect')).toBeEnabled()

  await clearPerfScenario(page)
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  await page.getByTestId('hosting-secret').press('Enter')
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  const rows = await page.evaluate(browserTakeLoafScripts)
  console.log(
    `hosting-connect: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)

  expect(
    r2.seen.filter((r) => r.method !== 'OPTIONS').map((r) => r.method),
  ).toEqual(['PUT', 'HEAD', 'DELETE'])
  expect(
    r2.seen.every(
      (r) => new URL(r.url).host === `${ACCOUNT}.r2.cloudflarestorage.com`,
    ),
  ).toBe(true)
  await expect(page.getByTestId('hosting-stored-key')).toHaveText('…9f2c')
  await expect(page.getByTestId('hosting-badge')).toHaveText('Connected')
  await expect(page.getByTestId('hosting-site')).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )

  const leaks = async () => {
    const html = await page.evaluate(() => document.documentElement.outerHTML)
    const storage = await page.evaluate(() =>
      Object.keys(localStorage)
        .map((key) => `${key}=${localStorage.getItem(key) ?? ''}`)
        .join('\n'),
    )
    return [html, storage, page.url(), ...logs].filter((text) =>
      text.includes(SECRET),
    )
  }
  expect(await leaks()).toEqual([])

  const before = r2.seen.length
  await openHosting(page)
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  await expect(page.getByTestId('hosting-stored-bucket')).toHaveText('my-books')
  // D9: opening Settings sends nothing.
  expect(r2.seen.length).toBe(before)
  expect(await leaks()).toEqual([])
})

test('a CORS failure shows the footer message and marks help step 3', async ({
  page,
}) => {
  await routeR2(page, () => 'cors')
  await openManual(page)
  await fill(page)
  await expect(page.getByTestId('hosting-help-step-3')).not.toHaveAttribute(
    'data-marked',
  )
  await page.getByTestId('hosting-connect').click()
  await expect(page.getByTestId('hosting-error')).toHaveText(
    'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
  )
  await expect(page.getByTestId('hosting-help-step-3')).toHaveCSS(
    'background-color',
    'rgba(57, 55, 56, 0.06)',
  )
  expect(await secretsCount(page)).toBe(0)
})

test('Checking keeps the Connect width and the inputs read-only', async ({
  page,
}) => {
  const r2 = await routeR2(page, () => 'hold')
  await openManual(page)
  await fill(page)
  const button = page.getByTestId('hosting-connect')
  const rest = await button.boundingBox()
  await button.click()
  await expect(button).toContainText('Checking…')
  await expect(page.getByTestId('hosting-form')).toHaveAttribute(
    'aria-busy',
    'true',
  )
  await expect(page.getByTestId('hosting-key')).toHaveAttribute('readonly', '')
  const busy = await button.boundingBox()
  expect(
    Math.abs((busy?.width ?? 0) - (rest?.width ?? -1)),
  ).toBeLessThanOrEqual(0.5)
  r2.release()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
})

test('Replace → Cancel changes nothing', async ({ page }) => {
  const r2 = await routeR2(page, () => 'ok')
  await openManual(page)
  await connect(page)
  const card = (await page.getByTestId('hosting-connected').textContent()) ?? ''
  const sent = r2.seen.length
  await page.getByTestId('hosting-replace').click()
  await expect(page.getByTestId('hosting-account')).toHaveValue(ACCOUNT)
  await expect(page.getByTestId('hosting-key')).toBeFocused()
  await expect(page.getByTestId('hosting-key')).toHaveValue('')
  await page.getByTestId('hosting-bucket').fill('other-bucket')
  await page.getByTestId('hosting-cancel').click()
  await expect(page.getByTestId('hosting-connected')).toHaveText(card)
  expect(r2.seen.length).toBe(sent)
  await openHosting(page)
  await expect(page.getByTestId('hosting-stored-bucket')).toHaveText('my-books')
})

test('Check again stores a failure that survives a reload without a new check', async ({
  page,
}) => {
  let answer: Answer = 'ok'
  const r2 = await routeR2(page, () => answer)
  await openManual(page)
  await connect(page)
  await expect(page.getByTestId('hosting-badge')).toHaveText('Connected')

  answer = 'cors'
  await page.getByTestId('hosting-recheck').click()
  const failed = async () => {
    await expect(page.getByTestId('hosting-badge')).toHaveText("Can't connect")
    await expect(page.getByTestId('hosting-checked')).toHaveText(
      /^Last check failed .+ at \d{2}:\d{2}$/,
    )
    await expect(page.getByTestId('hosting-error')).toHaveText(
      'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
    )
  }
  await failed()

  const before = r2.seen.length
  await openHosting(page)
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  await failed()
  // D9: opening Settings sends nothing.
  expect(r2.seen.length).toBe(before)
})

test('Forget → confirm → empty form and an empty IndexedDB store', async ({
  page,
}) => {
  await routeR2(page, () => 'ok')
  await openManual(page)
  await connect(page)
  expect(await secretsCount(page)).toBe(2)
  await page.getByTestId('hosting-forget').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Forget the hosting token?')
  await dialog.getByRole('button', { name: 'Forget token' }).click()
  await expect(page.getByTestId('hosting-form')).toBeVisible()
  await expect(page.getByTestId('hosting-account')).toHaveValue('')
  await expect(page.getByTestId('hosting-account')).toBeFocused()
  expect(await secretsCount(page)).toBe(0)
})

test('an invalid value paints the error ring', async ({ page }) => {
  await routeR2(page, () => 'ok')
  await openManual(page)
  await page.getByTestId('hosting-bucket').fill('A')
  await expect(page.getByTestId('hosting-bucket')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  const field = (id: string) => page.getByTestId(id).locator('xpath=..')
  const leftEdge = async (id: string) => {
    const box = await field(id).boundingBox()
    const [pixel] = await pixelsAt(field(id), [
      { x: 0, y: (box?.height ?? 0) / 2 },
    ])
    return pixel ?? []
  }
  const [r, g, b] = await leftEdge('hosting-bucket')
  // #a8403a ring, inset 1 px on the box edge.
  expect(Math.abs((r ?? 0) - 0xa8)).toBeLessThanOrEqual(8)
  expect(Math.abs((g ?? 0) - 0x40)).toBeLessThanOrEqual(8)
  expect(Math.abs((b ?? 0) - 0x3a)).toBeLessThanOrEqual(8)
  // A valid neighbour's edge stays grey.
  const [vr, vg, vb] = await leftEdge('hosting-key')
  expect(
    Math.max(vr ?? 0, vg ?? 0, vb ?? 0) - Math.min(vr ?? 0, vg ?? 0, vb ?? 0),
  ).toBeLessThanOrEqual(6)
  await expect(page.getByTestId('hosting-connect')).toBeDisabled()
})
