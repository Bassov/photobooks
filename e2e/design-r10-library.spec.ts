import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'

// Owner Musts M64–M66, round 10, relayed by the Designer 2026-11-01 (review r9).
// Kit values measured on the rendered kit `uikit#/demo` at 1440 × 900 with
// this suite's browser (Playwright Desktop Chrome, default font hinting) and
// getBoundingClientRect / getComputedStyle, steps `welcome`, `library-empty`,
// `library-one-book` ("Lake trip") and `settings-from-library`. Positions are
// element boxes; the Designer's renderer (hinting off) quotes text tops and
// fractional widths, given in brackets where they differ.
//
// M65 Welcome: eyebrow y 242.91; h1 y 279.71, 90.72px / 400 / -3.6288px;
//     "for your books." <em> 581.58 wide [581.33], synthesized italic of upright
//     Lora; paragraph y 478.24 [text 482.24], 28 under the h1; credit box
//     right 1416, y 24, links rgb(83, 81, 82).
// M64 empty library: "Your books" 34px / 400 / normal at (128, 96); "Fog"
//     49px / 400 / -0.98px, x 447.27, 79.06 wide; figure x 310.8; text column
//     x 749.19, eyebrow y 348.16, h1 y 380.95 (57.6px / 400 / -2.016px), <em>
//     278.81 wide, paragraph y 513.83 (20 under the h1 box; text gap 15.44),
//     Create book y 601.83; credit y 723, links rgb(83, 81, 82).
// M64 library with a book: "Your books" y 102; cover title "Lake trip" <em>
//     26px / 400 / -0.52px, 103.33 wide.
// M66 Settings: back button x 12, 78 wide [79.73] (ink: design-r10-chrome); crumb
//     "Settings" x 98 [99.73]; section title y 72, line-height 31.2px;
//     paragraph y 107.19; "Library folder" y 179.61 [text 180.61]; "Allowed ·
//     read and write" rgb(57, 55, 56), y 295.44.

const POS = 0.5
const MUTED = 'rgb(83, 81, 82)'
const INK = 'rgb(57, 55, 56)'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

async function openWelcome(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await fontsReady(page)
}

async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

async function box(
  loc: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await loc.boundingBox()
  if (!b) {
    throw new Error('no box')
  }
  return b
}

async function expectAt(
  loc: Locator,
  at: { x?: number; y?: number; width?: number },
): Promise<void> {
  const b = await box(loc)
  for (const key of ['x', 'y', 'width'] as const) {
    const want = at[key]
    if (want !== undefined) {
      expect(Math.abs(b[key] - want), key).toBeLessThanOrEqual(POS)
    }
  }
}

async function expectType(
  loc: Locator,
  type: { size: string; weight: string; tracking: string; color?: string },
): Promise<void> {
  await expect(loc).toHaveCSS('font-size', type.size)
  await expect(loc).toHaveCSS('font-weight', type.weight)
  await expect(loc).toHaveCSS('letter-spacing', type.tracking)
  if (type.color) await expect(loc).toHaveCSS('color', type.color)
}

/** Kit italic: no Lora italic face, so the <em> is a synthesized oblique. */
async function expectKitItalic(em: Locator): Promise<void> {
  await expect(em).toHaveCSS('font-style', 'italic')
  await expect(em).toHaveCSS('font-family', /^"Lora Upright"/)
}

async function expectCreditLinks(credit: Locator): Promise<void> {
  await expect(credit).toHaveCSS('color', MUTED)
  const links = credit.locator('a')
  await expect(links).toHaveCount(2)
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', MUTED)
  }
}

test('M65 welcome: text block, headline gap and italic width match the kit', async ({
  page,
}) => {
  await openWelcome(page)
  const screen = page.getByTestId('welcome-screen')
  const eyebrow = screen.getByText('Welcome to Photobooks')
  const h1 = screen.getByRole('heading', { level: 1 })
  const em = h1.locator('em')
  const lead = screen.getByText(/^One folder on your disk/)

  await expectAt(eyebrow, { x: 56, y: 242.91 })
  await expectAt(h1, { y: 279.71 })
  await expectType(h1, {
    size: '90.72px',
    weight: '400',
    tracking: '-3.6288px',
    color: INK,
  })
  await expectKitItalic(em)
  await expectAt(em, { width: 581.58 })
  await expectAt(lead, { y: 478.24 })
  const gap = (await box(lead)).y - ((await box(h1)).y + (await box(h1)).height)
  expect(Math.abs(gap - 28)).toBeLessThanOrEqual(POS)

  const credit = page.getByTestId('screen-credit')
  const c = await box(credit)
  expect(Math.abs(c.y - 24)).toBeLessThanOrEqual(POS)
  expect(Math.abs(c.x + c.width - 1416)).toBeLessThanOrEqual(POS)
  await expectCreditLinks(credit)
})

test('M64 empty library: Lora weights, column x, headline gap and credit match the kit', async ({
  page,
}) => {
  await openWelcome(page)
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('missing api')
    }
    await api.seedHomeRecentsForTests(0)
  })
  const empty = page.getByTestId('library-empty')
  await expect(empty).toBeVisible({ timeout: 15_000 })
  await fontsReady(page)

  const heading = page.getByRole('heading', { name: 'Your books' })
  await expectType(heading, {
    size: '34px',
    weight: '400',
    tracking: 'normal',
    color: INK,
  })
  await expectAt(heading, { x: 128, y: 96 })

  const fog = page.getByTestId('example-book').locator('em')
  await expectType(fog, { size: '49px', weight: '400', tracking: '-0.98px' })
  await expectKitItalic(fog)
  await expectAt(fog, { x: 447.27, width: 79.06 })
  await expectAt(page.getByTestId('example-book'), { x: 310.8 })

  await expectAt(empty.getByText('Your library is ready'), {
    x: 749.19,
    y: 348.16,
  })
  const h1 = empty.getByRole('heading', { level: 1 })
  await expectType(h1, {
    size: '57.6px',
    weight: '400',
    tracking: '-2.016px',
    color: INK,
  })
  await expectKitItalic(h1.locator('em'))
  await expectAt(h1, { x: 749.19, y: 380.95 })
  await expectAt(h1.locator('em'), { width: 278.81 })
  const lead = empty.getByText(/^Create a book, then add/)
  await expectAt(lead, { x: 749.19, y: 513.83 })
  const gap = (await box(lead)).y - ((await box(h1)).y + (await box(h1)).height)
  expect(Math.abs(gap - 20)).toBeLessThanOrEqual(POS)
  await expectAt(page.getByTestId('new-book'), { x: 749.19, y: 601.83 })

  const credit = page.getByTestId('screen-credit')
  await expectAt(credit, { y: 723 })
  await expectCreditLinks(credit)

  await page.getByTestId('new-book').click()
  await expect(page.getByTestId('create-book-dialog')).toBeVisible()
})

test('M64 library with a book: heading and cover title weights match the kit', async ({
  page,
}) => {
  await openWelcome(page)
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary('Lake trip')
    if (!created.ok) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await fontsReady(page)

  const heading = page.getByRole('heading', { name: 'Your books' })
  await expectType(heading, { size: '34px', weight: '400', tracking: 'normal' })
  await expectAt(heading, { x: 128, y: 102 })
  const title = page.getByTestId('book-object-ink').locator('em').first()
  await expect(title).toHaveText('Lake trip')
  await expectType(title, { size: '26px', weight: '400', tracking: '-0.52px' })
  await expectKitItalic(title)
  await expectAt(title, { width: 103.33 })
})

test('M66 settings: crumb x, content offset and badge ink match the kit', async ({
  page,
}) => {
  await openWelcome(page)
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary('Lake trip')
    if (!created.ok) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('library-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  await fontsReady(page)

  const back = page.getByTestId('settings-back')
  await expectAt(back, { x: 12, width: 78 })
  await expectAt(back.locator('xpath=following-sibling::span[1]'), { x: 98 })

  const title = page.getByTestId('settings-section-title')
  await expectAt(title, { x: 252, y: 72 })
  await expect(title).toHaveCSS('line-height', '31.2px')
  const panel = page.getByTestId('library-settings-panel')
  await expectAt(page.getByTestId('settings-scroll').locator('p').first(), {
    y: 107.19,
  })
  await expectAt(panel.getByText('Library folder', { exact: true }), {
    x: 324,
    y: 179.61,
  })
  const badge = panel.getByText('Allowed · read and write')
  await expect(badge).toHaveCSS('color', INK)
  await expectAt(badge, { y: 295.44 })

  await back.click()
  await expect(page.getByTestId('settings')).toBeHidden()
  await expect(page.getByTestId('library-screen')).toBeVisible()
})
