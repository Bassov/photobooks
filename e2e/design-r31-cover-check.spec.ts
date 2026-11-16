import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// Designer cover-pdf C9 / CP4 (design-r31-cover-check): the product Print
// dialog's Check block lists the cover rows the PDF worker checks at 1 per
// sheet, as the kit `#/feature/pdf-export` "Cover check" / "No bleed"
// scenarios show them; booklets print no cover and list none.

test.use({ viewport: { width: 1440, height: 900 } })

const dialog = (page: Page) => page.getByTestId('print-dialog')
const check = (page: Page) => page.getByTestId('print-check')
const coverRows = (page: Page) =>
  check(page).locator('[data-rule^="cover-"], [data-rule^="spine-text-"]')

/** ≈ 500 mm of spine type: longer than the 230 mm Lake trip spine. */
const LONG_SPINE = 'Lake trip '.repeat(20).trim()

async function openPrint(page: Page) {
  await page.getByTestId('print').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  await expect(check(page)).toHaveAttribute('data-state', 'issues')
}

async function setSpineText(page: Page, text: string) {
  await page.evaluate((spine) => {
    const api = window.__photobooksProject
    if (!api?.dispatchBookOpForTests) {
      throw new Error('dispatchBookOpForTests missing')
    }
    api.dispatchBookOpForTests({
      type: 'setCoverText',
      panel: 'spine',
      text: spine,
    })
  }, text)
}

/** The row is painted: on top at its centre, with text ink across it. */
async function expectPainted(row: Locator) {
  await row.scrollIntoViewIfNeeded()
  const [top = []] = await topAt(row)
  expect(top).toContain('print-check-row')
  const b = await row.boundingBox()
  if (b === null) throw new Error('row not laid out')
  const line = Array.from({ length: 40 }, (_, i) => ({
    x: (b.width * (i + 0.5)) / 40,
    y: b.height / 2,
  }))
  const colours = new Set(
    (await pixelsAt(row, line)).map((rgba) => rgba.join(',')),
  )
  expect(colours.size).toBeGreaterThan(1)
}

test('a spine text longer than the spine: the spine-text-cut row at 1 per sheet, none with 2-up', async ({
  page,
}) => {
  await openLibraryBook(page)
  await setSpineText(page, LONG_SPINE)
  await openPrint(page)

  const cut = check(page).locator('[data-rule="spine-text-cut"]')
  await expect(cut).toHaveText(
    'Spine text is longer than the spine and ends in “…”',
  )
  await expectPainted(cut)

  await dialog(page).getByRole('radio', { name: '2-up' }).check()
  await expect(coverRows(page)).toHaveCount(0)
  await dialog(page).getByRole('radio', { name: '1 per sheet' }).check()
  await expect(cut).toBeVisible()
})

test('a new book without a front photo: the cover-front-empty row', async ({
  page,
}) => {
  await openLibraryBook(page)
  await openPrint(page)

  const empty = check(page).locator('[data-rule="cover-front-empty"]')
  await expect(empty).toHaveText(
    'Front cover has no photo and prints in the back fill colour',
  )
  await expectPainted(empty)
  await expect(check(page).locator('[data-rule="spine-text-cut"]')).toHaveCount(
    0,
  )
})
