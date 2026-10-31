import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { addSpreads } from './fixtures/layoutTiles'

// Design review r3: the rendered kit v0.10.0 `#/demo` (steps 13, 24) is the
// reference; source uikit/src/sandbox/v7.tsx:65-70,199-216.
const INK = 'rgb(232, 230, 227)'

test.beforeEach(async ({ page }) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await createBookViaLibrary(page, 'Lake trip')
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

const rect = (page: import('@playwright/test').Page, id: string) =>
  page
    .getByTestId(id)
    .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect)

test('M5: a new book shows its title as back text, bottom-left on the back cover', async ({
  page,
}) => {
  await page.getByTestId('cover-list-item').click()
  const field = page.getByTestId('cover-text-back')
  const text = page.getByTestId('cover-back-text')
  await expect(field).toHaveValue('Lake trip')
  await expect(text).toHaveText('Lake trip')
  await expect(text).toHaveCSS('color', INK)
  const [back, label] = await Promise.all([
    rect(page, 'cover-back'),
    rect(page, 'cover-back-text'),
  ])
  // Kit: left 12 %, bottom 10 % of the back panel.
  expect(label.x - back.x).toBeCloseTo(back.width * 0.12, 0)
  expect(back.bottom - label.bottom).toBeCloseTo(back.height * 0.1, 0)

  await field.fill('See you next summer')
  await expect(text).toHaveText('See you next summer')

  // Kit v7.tsx:202: Book settings names the book by its back text.
  await page.getByTestId('book-title').click()
  await expect(page.getByTestId('book-settings-subtitle')).toHaveText(
    'See you next summer · applies to the whole book',
  )
})

test('Spine width: read-only mm text that matches the canvas spine', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const trimWidthMm = Number(await page.getByTestId('size-w').inputValue()) * 10
  expect(trimWidthMm).toBeGreaterThan(0)

  await page.getByTestId('cover-list-item').click()
  const spineWidth = page.getByTestId('cover-spine-width')
  await expect(spineWidth).toHaveText('12 mm')
  await expect(spineWidth).toHaveCSS('font-family', /mono/i)
  await expect(spineWidth.locator('input')).toHaveCount(0)
  await expect(page.getByTestId('insp-cover').getByRole('slider')).toHaveCount(
    0,
  )
  // The stored 12 mm drives the canvas: spine / back = 12 / trim width.
  const [back, spine] = await Promise.all([
    rect(page, 'cover-back'),
    rect(page, 'cover-spine'),
  ])
  expect(spine.width / back.width).toBeCloseTo(12 / trimWidthMm, 2)
})

test('Pages: read-only count, 20–120 hint and a spreads note that follows the book', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const pages = page.getByTestId('book-pages')
  const note = page.getByTestId('book-pages-note')
  await expect(pages).toHaveText('620–120')
  await expect(page.getByTestId('book-pages-range')).toHaveText('20–120')
  await expect(pages.locator('input, button')).toHaveCount(0)
  await expect(note).toHaveText('Add 7 spreads to reach the 20-page minimum')

  await addSpreads(page, 6)
  await page.getByTestId('book-title').click()
  await expect(pages).toHaveText('1820–120')
  await expect(note).toHaveText('Add 1 spread to reach the 20-page minimum')

  await addSpreads(page, 1)
  await page.getByTestId('book-title').click()
  await expect(pages).toHaveText('2020–120')
  await expect(note).toHaveText('Pages are added in spreads of 2')
})
