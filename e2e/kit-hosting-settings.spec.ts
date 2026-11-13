import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// publish-credentials (kit): Settings → Hosting. KM1 the entry form, KM2 the
// connected card, KM3 the help card and the PublishDialog host. The check is
// simulated (900 ms); the secret never reaches the DOM or the URL.

const KIT = '/uikit/#/full/site-settings'
const ACCOUNT = '0f3a9c51e2b74d0a8c66f1e9d3b241c2'
// Low-entropy fakes (gitleaks): still 32 / 64 hex, the key ends in 9a7b.
const KEY = `${'cd'.repeat(14)}9a7b`
const SECRET = 'd4c3b2a1'.repeat(8)

test.use({ viewport: { width: 1440, height: 900 } })

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

async function scenario(page: Page, name: string) {
  await page.goto(KIT)
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name, exact: true })
    .click()
}

const css = (l: Locator, prop: string) =>
  l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

const fieldBox = (page: Page, id: string) => page.getByTestId(id).locator('..')

const lineOf = (page: Page, id: string) =>
  page.getByTestId(`${id}-row`).locator(`[id$="-line"]`)

async function fillValid(page: Page) {
  await page.getByTestId('hosting-account').fill(ACCOUNT)
  await page.getByTestId('hosting-bucket').fill('aleksandr-books')
  await page.getByTestId('hosting-key').fill(KEY)
  await page.getByTestId('hosting-secret').fill(SECRET)
  await page.getByTestId('hosting-url').fill('books.basov.photo')
  await page.getByTestId('hosting-url').blur()
}

test.describe('KM1 form', () => {
  test('nav, five fields in Cloudflare order, Spec geometry, help open', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    const nav = page.locator('[data-testid^="settings-nav-"]')
    await expect(nav.nth(1)).toHaveAttribute(
      'data-testid',
      'settings-nav-hosting',
    )
    await expect(nav.nth(1)).toHaveText('Hosting')
    await expect(nav.nth(1).locator('svg')).toHaveClass(/lucide-key-round/)
    const form = page.getByTestId('hosting-form')
    await expect(form.locator('input')).toHaveCount(5)
    const ids = await form
      .locator('input')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    expect(ids).toEqual([
      'hosting-account',
      'hosting-bucket',
      'hosting-key',
      'hosting-secret',
      'hosting-url',
    ])
    await expect(form.locator('label')).toHaveText([
      'Account ID',
      'Bucket',
      'Access key ID',
      'Secret access key',
      'Site address',
    ])
    expect(await form.locator('input[name]').count()).toBe(0)
    await expect(page.getByTestId('hosting-secret')).toHaveAttribute(
      'type',
      'password',
    )
    near((await box(form)).width, 640)
    expect(await css(form, 'border-top-left-radius')).toBe('14px')
    near((await box(page.getByTestId('hosting-bucket-row'))).height, 52)
    near((await box(page.getByTestId('hosting-account-row'))).height, 68.8)
    const field = fieldBox(page, 'hosting-bucket')
    near((await box(field)).height, 32)
    expect(await css(field, 'border-top-left-radius')).toBe('8px')
    const label = page.getByTestId('hosting-bucket-row').locator('label')
    near((await box(label)).width, 160)
    const hint = lineOf(page, 'hosting-account')
    expect(await css(hint, 'font-size')).toBe('12px')
    expect(await css(hint, 'line-height')).toBe('16.8px')
    await expect(page.getByTestId('hosting-connect')).toBeDisabled()
    await expect(page.getByTestId('hosting-help').locator('li')).toHaveCount(5)
    await expect(page.getByTestId('hosting-cors-json')).toContainText(
      '"AllowedMethods": ["GET", "HEAD", "PUT", "DELETE"]',
    )
  })

  test('format errors show as you type, with the Spec texts', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    const cases: [string, string, string][] = [
      [
        'hosting-account',
        'xyz',
        'The account ID is 32 characters, 0–9 and a–f.',
      ],
      [
        'hosting-account',
        `https://${ACCOUNT}.eu.r2.cloudflarestorage.com`,
        "Buckets with a jurisdiction (EU, FedRAMP) aren't supported yet.",
      ],
      [
        'hosting-bucket',
        'Aleksandr_Books',
        'Bucket names are 3–63 characters: a–z, 0–9 and hyphens.',
      ],
      ['hosting-key', '12', 'The access key ID is 32 characters, 0–9 and a–f.'],
      ['hosting-secret', 'zz', 'The secret is 64 characters, 0–9 and a–f.'],
      ['hosting-url', 'http://books.example.com', 'Use https://.'],
      [
        'hosting-url',
        'https://books.example.com/site',
        'Use the domain only, without a path.',
      ],
      [
        'hosting-url',
        'https://pub-41c2a0.r2.dev',
        'Use the custom domain. The r2.dev address is for testing only.',
      ],
      [
        'hosting-url',
        'https://',
        'Enter a web address, like https://books.example.com.',
      ],
    ]
    for (const [id, value, text] of cases) {
      await page.getByTestId(id).fill(value)
      await expect(lineOf(page, id)).toHaveText(text)
      await expect(page.getByTestId(id)).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByTestId('hosting-connect')).toBeDisabled()
    }
    await page.getByTestId('hosting-bucket').fill('')
    await expect(page.getByTestId('hosting-bucket')).not.toHaveAttribute(
      'aria-invalid',
    )
    // the error ring paints the Spec red (#a8403a) on the field's left edge
    const ringed = fieldBox(page, 'hosting-account')
    const [[r, g, b] = []] = await pixelsAt(ringed, [{ x: 0, y: 16 }])
    expect(r).toBeGreaterThan(140)
    expect(g).toBeLessThan(100)
    expect(b).toBeLessThan(100)
    const [[r2 = 0, g2 = 0] = []] = await pixelsAt(
      fieldBox(page, 'hosting-bucket'),
      [{ x: 0, y: 16 }],
    )
    expect(Math.abs(r2 - g2)).toBeLessThan(12)
  })

  test('the S3 endpoint URL becomes the id and fills an empty Bucket', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    const account = page.getByTestId('hosting-account')
    await account.fill(
      `https://${ACCOUNT.toUpperCase()}.r2.cloudflarestorage.com/aleksandr-books`,
    )
    await account.blur()
    await expect(account).toHaveValue(ACCOUNT)
    await expect(page.getByTestId('hosting-bucket')).toHaveValue(
      'aleksandr-books',
    )
  })

  test('Connect → Checking… keeps the width, fields readOnly; the secret never reaches the DOM', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    await fillValid(page)
    await expect(page.getByTestId('hosting-url')).toHaveValue(
      'https://books.basov.photo',
    )
    expect(
      await page.getByTestId('hosting-secret').getAttribute('value'),
    ).toBeNull()
    const connect = page.getByTestId('hosting-connect')
    await expect(connect).toBeEnabled()
    const w = (await box(connect)).width
    await page.getByTestId('hosting-key').press('Enter')
    await expect(connect).toHaveAccessibleName('Checking…')
    near((await box(connect)).width, w)
    await expect(page.getByTestId('hosting-form')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(page.getByTestId('hosting-account')).toHaveAttribute(
      'readonly',
      '',
    )
    await expect(page.getByTestId('hosting-connected')).toBeVisible()
    await expect(page.getByTestId('hosting-help')).toHaveCount(0)
    await expect(page.getByTestId('hosting-stored-key')).toHaveText('…9a7b')
    const html = await page.evaluate(() => document.documentElement.outerHTML)
    expect(html).not.toContain(SECRET)
    expect(html).not.toContain(KEY)
    expect(page.url()).not.toContain(SECRET)
  })

  test('a failed CORS check marks help step 3; Copy shows Copied for 2 s', async ({
    page,
  }) => {
    await scenario(page, 'Check failed')
    await expect(page.getByTestId('hosting-error')).toHaveText(
      'Cloudflare blocked the upload from this page. Add the CORS policy from step 3, then try again.',
    )
    const step3 = page.getByTestId('hosting-step-3')
    expect(await css(step3, 'background-color')).toBe('rgba(57, 55, 56, 0.06)')
    expect(
      await css(page.getByTestId('hosting-step-2'), 'background-color'),
    ).toBe('rgba(0, 0, 0, 0)')
    const copy = page.getByTestId('hosting-cors-copy')
    const w = (await box(copy)).width
    await copy.click()
    await expect(copy).toHaveAccessibleName('Copied')
    near((await box(copy)).width, w)
    await expect(copy).toHaveAccessibleName('Copy', { timeout: 4000 })
  })

  test('the checking scenario holds Checking…; a missing bucket rings account and bucket', async ({
    page,
  }) => {
    await scenario(page, 'Checking')
    await expect(page.getByTestId('hosting-connect')).toHaveAccessibleName(
      'Checking…',
    )
    await expect(page.getByTestId('hosting-url')).toHaveAttribute(
      'readonly',
      '',
    )
    await scenario(page, 'Not connected')
    await fillValid(page)
    await page.getByTestId('hosting-bucket').fill('missing')
    await page.getByTestId('hosting-connect').click()
    await expect(page.getByTestId('hosting-error')).toHaveText(
      "There's no bucket “missing” in this account.",
    )
    for (const id of ['hosting-account', 'hosting-bucket'])
      expect(await css(fieldBox(page, id), 'box-shadow')).toContain(
        'rgb(168, 64, 58)',
      )
  })
})

test.describe('KM2 connected card', () => {
  test('rows, badge, Check again; the stored secret is 12 dots', async ({
    page,
  }) => {
    await scenario(page, 'Hosting')
    const card = page.getByTestId('hosting-connected')
    await expect(card).toContainText('Connected')
    await expect(page.getByTestId('hosting-checked')).toHaveText(
      'Checked today at 22:40',
    )
    const site = page.getByTestId('hosting-site')
    await expect(site).toHaveText('books.basov.photo')
    await expect(site).toHaveAttribute('href', 'https://books.basov.photo')
    await expect(site).toHaveAttribute('target', '_blank')
    await expect(site).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(page.getByTestId('hosting-stored-bucket')).toHaveText(
      'aleksandr-books',
    )
    await expect(page.getByTestId('hosting-stored-account')).toHaveText(
      '0f3a9c51e2b74d0a8c66f1e9d3b241c2',
    )
    await expect(page.getByTestId('hosting-stored-key')).toHaveText('…9f2c')
    const secret = page.getByTestId('hosting-stored-secret')
    await expect(secret).toHaveText('••••••••••••')
    await expect(secret).toHaveAttribute('aria-label', 'Stored, hidden')
    const forget = await box(page.getByTestId('hosting-forget'))
    const recheck = page.getByTestId('hosting-recheck')
    const replace = await box(page.getByTestId('hosting-replace'))
    const r = await box(recheck)
    expect(forget.x).toBeLessThan(r.x)
    near(r.x + r.width + 8, replace.x)
    await recheck.click()
    await expect(recheck).toHaveAccessibleName('Checking…')
    near((await box(recheck)).width, r.width)
    await expect(recheck).toHaveAccessibleName('Check again')
    await expect(page.getByTestId('hosting-checked')).toContainText(
      'Checked today at',
    )
  })

  test("a failed re-check: Can't connect, the time and the key message", async ({
    page,
  }) => {
    await scenario(page, 'Re-check failed')
    await expect(page.getByTestId('hosting-connected')).toContainText(
      "Can't connect",
    )
    await expect(page.getByTestId('hosting-checked')).toHaveText(
      'Last check failed today at 22:51',
    )
    await expect(page.getByTestId('hosting-error')).toHaveText(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
    )
  })

  test('Replace: key and secret empty, focus on the key; Cancel changes nothing', async ({
    page,
  }) => {
    await scenario(page, 'Hosting')
    await page.getByTestId('hosting-replace').click()
    await expect(page.getByTestId('hosting-key')).toBeFocused()
    await expect(page.getByTestId('hosting-account')).toHaveValue(
      '0f3a9c51e2b74d0a8c66f1e9d3b241c2',
    )
    await expect(page.getByTestId('hosting-bucket')).toHaveValue(
      'aleksandr-books',
    )
    await expect(page.getByTestId('hosting-url')).toHaveValue(
      'https://books.basov.photo',
    )
    await expect(page.getByTestId('hosting-key')).toHaveValue('')
    await expect(page.getByTestId('hosting-secret')).toHaveValue('')
    await expect(page.getByTestId('hosting-help')).toBeVisible()
    await page.getByTestId('hosting-bucket').fill('other-bucket')
    await page.getByTestId('hosting-cancel').click()
    await expect(page.getByTestId('hosting-stored-bucket')).toHaveText(
      'aleksandr-books',
    )
    await expect(page.getByTestId('hosting-stored-key')).toHaveText('…9f2c')
  })

  test('Forget: destructive confirm with the trash tile → empty form, focus on Account ID', async ({
    page,
  }) => {
    await scenario(page, 'Forget token')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Forget the hosting token?')
    await expect(dialog.locator('svg.lucide-trash-2')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Forget token' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('hosting-form')).toBeVisible()
    await expect(page.getByTestId('hosting-account')).toHaveValue('')
    await expect(page.getByTestId('hosting-account')).toBeFocused()
    await expect(page.getByTestId('hosting-help')).toBeVisible()
  })
})

test('KM3 PublishDialog names the host of the stored site address', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/in-app-publish')
  // the first state (no hosting) is modal: its scrim covers the tab strip
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name: 'Options', exact: true })
    .evaluate((t: HTMLElement) => {
      t.click()
    })
  await expect(page.getByTestId('publish-host-line')).toHaveText(
    '“Lake trip” goes to books.basov.photo with the other published books.',
  )
})
