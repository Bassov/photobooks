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

// connect-own-hosting: not connected opens the guided setup; the manual form is one link away
async function manualForm(page: Page) {
  await scenario(page, 'Not connected')
  await page.getByTestId('hosting-manual').click()
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
    await manualForm(page)
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
    await manualForm(page)
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
    await manualForm(page)
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
    await manualForm(page)
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
    const step3 = page.getByTestId('hosting-help-step-3')
    expect(await css(step3, 'background-color')).toBe('rgba(57, 55, 56, 0.06)')
    expect(
      await css(page.getByTestId('hosting-help-step-2'), 'background-color'),
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
    await manualForm(page)
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

// connect-own-hosting (kit): the guided setup. KS1 steps 1–2 and their
// states, KS2 the step 3 rows and resume, KS3 modes, Forget and scenarios.
// Cloudflare is simulated (Continue 900 ms, each row 600 ms).
const TOKEN = `kit${'Ab'.repeat(20)}`
const RUN = { timeout: 10_000 }

const rgbAt = async (l: Locator, x: number, y: number) =>
  (await pixelsAt(l, [{ x, y }]))[0] ?? []

const near3 = (a: number[], b: number[], d = 8) => {
  for (const k of [0, 1, 2])
    expect(
      Math.abs((a[k] ?? 0) - (b[k] ?? 0)),
      `${a.join()} ≈ ${b.join()}`,
    ).toBeLessThanOrEqual(d)
}

/** Some pixel of the box paints the Spec error red (#a8403a). */
async function paintsRed(l: Locator) {
  const b = await box(l)
  const pts = Array.from(
    { length: Math.floor(Math.min(b.width, 80)) * Math.floor(b.height) },
    (_, i) => ({ x: i % 80, y: Math.floor(i / 80) }),
  ).filter((p) => p.x < b.width - 1 && p.y < b.height - 1)
  const px = await pixelsAt(l, pts)
  return px.some(([r = 0, g = 0, bl = 0]) => r > 140 && g < 100 && bl < 100)
}

async function toAddress(page: Page) {
  await scenario(page, 'Not connected')
  await page.getByTestId('hosting-setup-token').fill(TOKEN)
  await page.getByTestId('hosting-setup-continue').click()
  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
}

const row = (page: Page, n: number) =>
  page.getByTestId(`hosting-setup-row-${String(n)}`)

test.describe('KS1 setup steps 1–2', () => {
  test('intro, step geometry, marker paint, token format, Continue width through Checking…', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    await expect(page.getByTestId('settings-hosting-intro')).toHaveText(
      'Publish puts your books on your own site, in your own Cloudflare account. Set it up once: Photobooks keeps only a key for its own bucket, on this computer.',
    )
    const card = page.getByTestId('hosting-setup')
    await expect(card).toBeVisible()
    await expect(page.getByTestId('hosting-form')).toBeHidden()
    near((await box(card)).width, 640)
    for (const n of [1, 2, 3]) {
      near(
        (await box(page.getByTestId(`hosting-step-${String(n)}`))).height,
        52,
      )
      const m = await box(page.getByTestId(`hosting-marker-${String(n)}`))
      near(m.width, 20)
      near(m.height, 20)
    }
    await expect(page.getByTestId('hosting-step-1')).toHaveAttribute(
      'aria-current',
      'step',
    )
    // paint: current = #232223 disc, future = transparent with a ring
    const bg = await rgbAt(page.getByTestId('hosting-step-3'), 600, 4)
    near3(
      await rgbAt(page.getByTestId('hosting-marker-1'), 10, 3),
      [35, 34, 35],
    )
    const future = page.getByTestId('hosting-marker-3')
    near3(await rgbAt(future, 10, 3), bg, 3)
    expect(
      (bg[0] ?? 0) - ((await rgbAt(future, 10, 0))[0] ?? 0),
    ).toBeGreaterThan(25)

    const token = page.getByTestId('hosting-setup-token')
    await expect(token).toHaveAttribute('type', 'password')
    await expect(token).toHaveAttribute('autocomplete', 'off')
    expect(await card.locator('input[name]').count()).toBe(0)
    near((await box(token.locator('..'))).height, 32)
    await expect(page.getByTestId('hosting-setup-template')).toHaveAttribute(
      'href',
      /^https:\/\/dash\.cloudflare\.com\/profile\/api-tokens\?permissionGroupKeys=/,
    )
    await expect(page.getByTestId('hosting-setup-template')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    const go = page.getByTestId('hosting-setup-continue')
    await expect(go).toBeDisabled()
    await token.fill('not a token')
    await expect(page.locator('#hosting-setup-token-line')).toHaveText(
      "This doesn't look like a Cloudflare API token.",
    )
    await expect(token).toHaveAttribute('aria-invalid', 'true')
    await expect(go).toBeDisabled()
    await token.fill(TOKEN)
    await expect(go).toBeEnabled()
    const w = (await box(go)).width
    await token.press('Enter')
    await expect(go).toHaveAccessibleName('Checking…')
    near((await box(go)).width, w)
    await expect(card).toHaveAttribute('aria-busy', 'true')
    await expect(token).toHaveAttribute('readonly', '')
    await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
      'aria-current',
      'step',
    )
    // done = #D7D7D7 disc with a Check; the summary is the account
    near3(
      await rgbAt(page.getByTestId('hosting-marker-1'), 10, 3),
      [215, 215, 215],
    )
    await expect(
      page.getByTestId('hosting-marker-1').locator('svg.lucide-check'),
    ).toHaveCount(1)
    await expect(page.getByTestId('hosting-step-1-summary')).toHaveText(
      'Aleksandr Basov',
    )
    near(
      (await box(page.getByTestId('hosting-setup-sub').locator('..'))).height,
      32,
    )
    near((await box(page.getByTestId('hosting-setup-zone'))).height, 32)
    near(
      (await box(page.getByTestId('hosting-setup-sub').locator('..'))).width,
      140,
    )
    const html = await page.evaluate(() => document.documentElement.outerHTML)
    expect(html).not.toContain(TOKEN)
    expect(page.url()).not.toContain(TOKEN)
    // Change re-opens step 1 and forgets the token
    await page.getByTestId('hosting-step-1-change').click()
    await expect(page.getByTestId('hosting-setup-token')).toHaveValue('')
    await expect(go).toBeDisabled()
  })

  test('token errors: a missing permission rings the token in red', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    await page
      .getByTestId('hosting-setup-token')
      .fill(`noperm${'x'.repeat(40)}`)
    await page.getByTestId('hosting-setup-continue').click()
    const fail = page.getByTestId('hosting-setup').getByTestId('hosting-error')
    await expect(fail).toHaveText(
      'This token is missing API Tokens · Edit. Create it again from the link above.',
    )
    await expect(page.getByTestId('hosting-setup-token')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    const [r = 0, g = 0, b = 0] = await rgbAt(
      page.getByTestId('hosting-setup-token').locator('..'),
      0,
      16,
    )
    expect(r).toBeGreaterThan(140)
    expect(g).toBeLessThan(100)
    expect(b).toBeLessThan(100)
  })

  test('R2 off box: Turn on R2 link; Check again goes on to step 2', async ({
    page,
  }) => {
    await scenario(page, 'R2 off')
    const box1 = page.getByTestId('hosting-setup-box')
    await expect(box1).toContainText('R2 is off in this account.')
    await expect(box1).toContainText(
      'Turn it on in Cloudflare. It asks for a card; the free tier holds about 25 books (10 GB).',
    )
    await expect(
      box1.getByRole('link', { name: 'Turn on R2' }),
    ).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/?to=/:account/r2/overview',
    )
    await expect(page.getByTestId('hosting-setup-token')).toHaveCount(0)
    const again = page.getByTestId('hosting-setup-recheck')
    const w = (await box(again)).width
    await again.click()
    await expect(again).toHaveAccessibleName('Checking…')
    near((await box(again)).width, w)
    await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
      'aria-current',
      'step',
    )
  })

  test('no active domain: the box, the pending zone, Set up disabled; Check again picks the zone', async ({
    page,
  }) => {
    await scenario(page, 'No domain')
    const box2 = page.getByTestId('hosting-setup-box')
    await expect(box2).toContainText('This account has no active domain yet.')
    await expect(box2).toContainText(
      'Waiting for nameservers: mybooks.org (can take up to 24 hours)',
    )
    await expect(
      box2.getByRole('link', { name: 'Add a domain' }),
    ).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/?to=/:account/add-site',
    )
    await expect(
      box2.getByRole('link', { name: 'Buy a domain' }),
    ).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/?to=/:account/domains/register',
    )
    await expect(page.getByTestId('hosting-setup-run')).toBeDisabled()
    await page.getByTestId('hosting-setup-recheck').click()
    await expect(page.getByTestId('hosting-setup-zone')).toHaveValue(
      'mybooks.org',
    )
    await expect(page.getByTestId('hosting-setup-host')).toContainText(
      'https://books.mybooks.org',
    )
    await expect(page.getByTestId('hosting-setup-run')).toBeEnabled()
  })

  test('address: host and bucket lines, reused bucket, subdomain rule, apex', async ({
    page,
  }) => {
    await scenario(page, 'Choose address')
    const host = page.getByTestId('hosting-setup-host')
    const bucket = page.getByTestId('hosting-setup-bucket')
    await expect(host).toHaveText(
      'Your site: https://books.basov.photo. Leave the first part empty to use basov.photo itself.',
    )
    await expect(bucket).toHaveText(
      'Storage: new R2 bucket pb-books-basov-photo',
    )
    const sub = page.getByTestId('hosting-setup-sub')
    await sub.fill('Family')
    await expect(sub).toHaveValue('family')
    await expect(bucket).toHaveText(
      'Storage: existing R2 bucket pb-family-basov-photo (reused)',
    )
    await sub.fill('bad_name')
    await expect(host).toHaveText('Use a–z, 0–9 and hyphens, like books.')
    await expect(page.getByTestId('hosting-setup-run')).toBeDisabled()
    await sub.fill('')
    await page.getByTestId('hosting-setup-zone').selectOption('example.com')
    await expect(host).toContainText('https://example.com.')
    await expect(bucket).toHaveText('Storage: new R2 bucket pb-example-com')
  })
})

test.describe('KS2 setup step 3', () => {
  test('a DNS conflict fails row 3 in red; Try again resumes there; Cancel → step 2; keep → the token-left line', async ({
    page,
  }) => {
    await toAddress(page)
    await page.getByTestId('hosting-setup-sub').fill('taken')
    await page.getByTestId('hosting-setup-run').click()
    await expect(
      page.getByTestId('hosting-setup-progress').locator('li'),
    ).toHaveCount(6)
    await expect(page.getByTestId('hosting-manual')).toHaveCount(0)
    await expect(page.getByTestId('hosting-step-2-change')).toHaveCount(0)
    await expect(row(page, 3)).toHaveAttribute('data-state', 'failed', RUN)
    await expect(page.getByTestId('hosting-setup-row-error')).toHaveText(
      'taken.basov.photo already points somewhere else in your DNS. Choose another address, or delete that record in Cloudflare.',
    )
    expect(await paintsRed(page.getByTestId('hosting-setup-row-3-text'))).toBe(
      true,
    )
    expect(await paintsRed(page.getByTestId('hosting-setup-row-4-text'))).toBe(
      false,
    )
    await expect(row(page, 4)).toHaveAttribute('data-state', 'pending')
    await expect(page.getByTestId('hosting-step-1-change')).toHaveCount(0)
    await expect(page.getByTestId('hosting-step-2-change')).toBeVisible()
    await page.getByTestId('hosting-setup-retry').click()
    await expect(row(page, 3)).toHaveAttribute('data-state', 'running')
    await expect(row(page, 1)).toHaveAttribute('data-state', 'done')
    await expect(row(page, 2)).toHaveAttribute('data-state', 'done')
    await expect(row(page, 3)).toHaveAttribute('data-state', 'failed', RUN)
    await page.getByTestId('hosting-setup-cancel').click()
    await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(page.getByTestId('hosting-setup-sub')).toHaveValue('taken')
    await page.getByTestId('hosting-setup-sub').fill('keep')
    await page.getByTestId('hosting-setup-run').click()
    await expect(page.getByTestId('hosting-connected')).toBeVisible(RUN)
    await expect(page.getByTestId('hosting-checked')).toContainText(
      'Set up automatically today at',
    )
    await expect(page.getByTestId('hosting-site')).toHaveText(
      'keep.basov.photo',
    )
    await expect(page.getByTestId('hosting-site-new')).toHaveText(
      'New address: it can take a few minutes to start working.',
    )
    await expect(page.getByTestId('hosting-stored-bucket')).toHaveText(
      'pb-keep-basov-photo',
    )
    await expect(page.getByTestId('hosting-token-left')).toHaveText(
      'Delete the “Photobooks setup” token in Cloudflare → API Tokens.',
    )
  })

  test('running: rows by state, no buttons; the failed scenario completes on Try again', async ({
    page,
  }) => {
    await scenario(page, 'Setting up')
    await expect(row(page, 1)).toHaveAttribute('data-state', 'done')
    await expect(row(page, 3)).toHaveAttribute('data-state', 'running')
    await expect(row(page, 4)).toHaveAttribute('data-state', 'pending')
    await expect(page.getByTestId('hosting-setup')).toContainText(
      'Keep this page open. It takes about a minute.',
    )
    await expect(
      page.getByTestId('hosting-setup').getByRole('button'),
    ).toHaveCount(0)
    await scenario(page, 'Setup failed')
    await expect(page.getByTestId('hosting-setup')).toContainText(
      'Done steps are kept. Try again goes on from the failed one.',
    )
    await page.getByTestId('hosting-setup-retry').click()
    await expect(page.getByTestId('hosting-connected')).toBeVisible(RUN)
    await expect(page.getByTestId('hosting-token-left')).toHaveCount(0)
    await page.getByTestId('hosting-recheck').click()
    await expect(page.getByTestId('hosting-checked')).toContainText(
      'Checked today at',
    )
  })
})

test.describe('KS3 modes, Forget, scenarios', () => {
  test('manual ↔ automatic keeps typed values; the secret and the token are dropped', async ({
    page,
  }) => {
    await scenario(page, 'Not connected')
    await page.getByTestId('hosting-setup-token').fill(TOKEN)
    await page.getByTestId('hosting-manual').click()
    await expect(page.getByTestId('hosting-setup')).toBeHidden()
    await expect(page.getByTestId('hosting-form')).toBeVisible()
    await page.getByTestId('hosting-account').fill(ACCOUNT)
    await page.getByTestId('hosting-secret').fill(SECRET)
    await page.getByTestId('hosting-guided').click()
    await expect(page.getByTestId('hosting-setup')).toBeVisible()
    await expect(page.getByTestId('hosting-help')).toBeHidden()
    await expect(page.getByTestId('hosting-setup-token')).toHaveValue('')
    await page.getByTestId('hosting-manual').click()
    await expect(page.getByTestId('hosting-account')).toHaveValue(ACCOUNT)
    await expect(page.getByTestId('hosting-secret')).toHaveValue('')
  })

  test('Forget a set-up record → the setup card, focus on the setup token', async ({
    page,
  }) => {
    await scenario(page, 'Set up')
    await page.getByTestId('hosting-forget').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Forget token' })
      .click()
    await expect(page.getByTestId('hosting-setup')).toBeVisible()
    await expect(page.getByTestId('hosting-setup-token')).toBeFocused()
  })

  test('every hosting scenario renders its card; no page-level scroll', async ({
    page,
  }) => {
    const cases: [string, string][] = [
      ['Not connected', 'hosting-setup'],
      ['Checking token', 'hosting-setup'],
      ['R2 off', 'hosting-setup-box'],
      ['Choose address', 'hosting-setup-sub'],
      ['No domain', 'hosting-setup-box'],
      ['Setting up', 'hosting-setup-progress'],
      ['Setup failed', 'hosting-setup-row-error'],
      ['Set up', 'hosting-token-left'],
      ['Manual form', 'hosting-form'],
    ]
    for (const [name, id] of cases) {
      await scenario(page, name)
      await expect(page.getByTestId(id), name).toBeVisible()
      const over = await page.evaluate(() => {
        const s = document.scrollingElement ?? document.documentElement
        return [s.scrollWidth - s.clientWidth, s.scrollHeight - s.clientHeight]
      })
      expect(over, name).toEqual([0, 0])
    }
    await scenario(page, 'Checking token')
    await expect(
      page.getByTestId('hosting-setup-continue'),
    ).toHaveAccessibleName('Checking…')
  })
})
