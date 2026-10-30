import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// uikit/src/index.css: --field #D7D7D7.
const FIELD = 'rgb(215, 215, 215)'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await applyLayout(page, 'Full bleed', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

const filled = (page: Page) =>
  page.locator('[data-testid="spread-frame"][data-filled="true"]')

const context = (page: Page) => page.getByTestId('inspector-context')

test('the inspector has no tabs and follows the selection (#15)', async ({
  page,
}) => {
  await expect(
    page.getByTestId('inspector-panel').getByRole('tablist'),
  ).toHaveCount(0)
  await expect(page.getByTestId('inspector-panel')).toBeVisible()
  await filled(page).click()
  await expect(context(page)).toHaveText('Photo')
  await expect(
    page.getByTestId('inspector-panel').getByRole('tablist'),
  ).toHaveCount(0)
})

test('the Spread context shows Pages summary, Layout and Grid (#16)', async ({
  page,
}) => {
  await expect(context(page)).toHaveText('Spread')
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^(Cover|Pages \d+–\d+) · \d+ empty$/,
  )
  await expect(page.getByTestId('layout-section')).toBeVisible()
  await expect(page.getByTestId('layout-tile').first()).toBeVisible()
  await expect(page.getByTestId('grid-section-spread')).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test('the book title opens Book settings until another item is picked (#17)', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  await expect(context(page)).toHaveText('Book settings')
  await expect(page.getByTestId('book-settings')).toBeVisible()
  // Kit book settings have no Layout grid section (uikit/src/sandbox/v7.tsx:202-210).
  await expect(page.getByTestId('grid-section-book')).toHaveCount(0)
  await expect(page.getByTestId('layout-section')).toHaveCount(0)
  await filled(page).click()
  await expect(context(page)).toHaveText('Photo')
  await expect(page.getByTestId('book-settings')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('crop mode keeps the Photo context (#18)', async ({ page }) => {
  await filled(page).click()
  await filled(page).dblclick()
  await expect(filled(page)).toHaveAttribute('data-crop-active', 'true')
  await expect(context(page)).toHaveText('Photo')
  await expect(page.getByTestId('inspector-empty')).toHaveCount(0)
  await expect(page.getByTestId('crop-toggle')).toHaveText('Done')
  await expect(page.getByTestId('inspector-photo')).toBeVisible()
})

test('Photo block shows thumb, pixels, ppi chip and Remove from frame (#19)', async ({
  page,
}) => {
  await filled(page).click()
  const photo = page.getByTestId('inspector-photo')
  await expect(photo.getByTestId('inspector-photo-px')).toContainText('px')
  await expect(photo.getByTestId('inspector-photo-dpi')).toContainText('ppi')
  await photo.getByTestId('photo-remove').click()
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
})

test('Photo sections follow the kit order; the rest is collapsed (#19)', async ({
  page,
}) => {
  await filled(page).click()
  const body = page.getByTestId('inspector-body')
  await expect(page.getByTestId('inspector-photo')).toBeVisible()
  const wanted = [
    'inspector-photo',
    'inspector-fit-crop',
    'inspector-rotate',
    'inspector-geometry-disclosure',
    'inspector-arrange-disclosure',
  ]
  const seen = await body.evaluate(
    (el, ids) =>
      [...el.querySelectorAll('[data-testid]')]
        .map((node) => node.getAttribute('data-testid') ?? '')
        .filter((id) => ids.includes(id)),
    wanted,
  )
  expect(seen).toEqual(wanted)
  for (const name of ['Position & size', 'Arrange']) {
    await expect(
      page.getByRole('button', { name, exact: true }),
    ).toHaveAttribute('aria-expanded', 'false')
  }
  await assertDocumentFitsViewport(page)
})

test('Crop is a borderless field fill, Reset has no outline (#20)', async ({
  page,
}) => {
  await filled(page).click()
  const paint = (id: string) =>
    page.getByTestId(id).evaluate((el) => {
      const style = getComputedStyle(el)
      return { border: style.borderTopColor, bg: style.backgroundColor }
    })
  const crop = await paint('crop-toggle')
  expect(crop).toEqual({ border: 'rgba(0, 0, 0, 0)', bg: FIELD })
  expect((await paint('crop-reset')).border).toBe('rgba(0, 0, 0, 0)')
})
