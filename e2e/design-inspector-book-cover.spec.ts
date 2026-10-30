import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
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

const inspector = (page: Page) => page.getByTestId('inspector-panel')
const filled = (page: Page) =>
  page.locator('[data-testid="spread-frame"][data-filled="true"]')

// Book settings: uikit/src/sandbox/v7.tsx:200-210 (size 175-178, binding 205-206).
test('Book settings edits size, orientation, units and endpapers (#17)', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const panel = page.getByTestId('book-settings')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('binding-readonly')).toHaveText('read-only')
  await panel.getByTestId('size-unit').getByText('mm').click()
  const width = panel.getByTestId('size-w')
  const height = panel.getByTestId('size-h')
  await width.fill('200')
  await height.fill('250')
  await expect(width).toHaveValue('200')
  await panel.getByTestId('size-orientation').getByText('Landscape').click()
  await expect(width).toHaveValue('250')
  await expect(height).toHaveValue('200')
  await panel.getByTestId('size-orientation').getByText('Portrait').click()
  await expect(width).toHaveValue('200')

  const toggle = panel.getByRole('switch', { name: 'Endpapers' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Endpaper', { exact: true })).toHaveCount(2)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('Endpaper', { exact: true })).toHaveCount(0)
  await toggle.click()
  await expect(page.getByText('Endpaper', { exact: true })).toHaveCount(2)

  await panel.getByRole('button', { name: 'Cream' }).click()
  await expect(panel.getByRole('button', { name: 'Cream' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

// Cover inspector: uikit/src/sandbox/v7.tsx:213-217.
test('Cover inspector style controls change the cover (#14)', async ({
  page,
}) => {
  await page.getByTestId('cover-list-item').click()
  const cover = page.getByTestId('insp-cover')
  await expect(cover).toBeVisible()
  await expect(cover.getByText('coming later')).toHaveCount(0)
  await cover.getByTestId('cover-title-font').selectOption('sans')
  await expect(page.getByTestId('canvas-cover')).toHaveAttribute(
    'data-title-font',
    'sans',
  )
  await cover.getByTestId('cover-material').selectOption('linen')
  await cover.getByTestId('cover-finish').selectOption('gloss')
  await expect(page.getByTestId('canvas-cover')).toHaveAttribute(
    'data-material',
    'linen',
  )
  await expect(page.getByTestId('canvas-cover')).toHaveAttribute(
    'data-finish',
    'gloss',
  )
  await cover.getByRole('radio', { name: 'Bottom to top' }).check({
    force: true,
  })
  await expect(page.getByTestId('cover-spine-text')).toHaveAttribute(
    'data-direction',
    'bottom-to-top',
  )
  await cover.getByRole('button', { name: 'Navy' }).click()
  await expect(page.getByTestId('cover-back')).toHaveCSS(
    'background-color',
    'rgb(31, 42, 68)',
  )
  const spine = page.getByTestId('cover-spine')
  const before = (await spine.boundingBox())?.width ?? 0
  await cover.getByTestId('cover-spine-width').getByRole('slider').focus()
  await page.keyboard.press('End')
  await expect
    .poll(async () => (await spine.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before)
})

// Spread list: uikit/src/sandbox/chrome.tsx:275,278; inspector v7.tsx:218-222.
test('Spread list has front and back Endpaper rows with an inspector (#12)', async ({
  page,
}) => {
  const front = page.getByTestId('endpaper-list-item-front')
  const back = page.getByTestId('endpaper-list-item-back')
  await expect(front).toContainText('Endpaper')
  await expect(back).toContainText('Endpaper')
  await front.click()
  await expect(page.getByTestId('canvas-endpaper')).toContainText(
    'Pastedown · glued to front board',
  )
  await expect(front).toHaveAttribute('aria-pressed', 'true')
  const insp = page.getByTestId('insp-endpaper')
  await expect(insp).toContainText('Endpaper · front')
  await expect(insp).toContainText(
    'Pastedown and free leaf, printed full bleed',
  )
  await back.click()
  await expect(page.getByTestId('canvas-endpaper')).toContainText(
    'Pastedown · glued to back board',
  )
  await expect(front).toHaveAttribute('aria-pressed', 'false')
  const same = page.getByTestId('endpaper-same')
  await same.click()
  await expect(same).toHaveAttribute('aria-checked', 'false')
  await page.getByTestId('cover-list-item').click()
  await expect(page.getByTestId('canvas-endpaper')).toHaveCount(0)
})

// uikit/src/sandbox/context-inspector.tsx:59 labels the first spread "Page 1".
test('Photo context labels the first spread "Page 1" (#18)', async ({
  page,
}) => {
  await filled(page).click()
  await expect(
    inspector(page).getByText('Spread', { exact: true }),
  ).toBeVisible()
  await expect(
    inspector(page).getByText('Page 1', { exact: true }),
  ).toBeVisible()
  await expect(inspector(page).getByText('Cover', { exact: true })).toHaveCount(
    0,
  )
})

// Photo sections: uikit/src/sandbox/context-inspector.tsx:71.
test('Photo inspector has Adjust, Caption and Frame style (#19)', async ({
  page,
}) => {
  await filled(page).click()
  await inspector(page).getByRole('button', { name: 'Adjust' }).click()
  await expect(inspector(page).getByTestId('adjust')).toBeVisible()
  const brightness = inspector(page)
    .getByTestId('adjust-brightness')
    .getByRole('slider')
  await brightness.focus()
  await page.keyboard.press('End')
  await expect(
    page
      .locator('[data-testid="spread-frame"][data-filled="true"] img')
      .first(),
  ).toHaveCSS('filter', /brightness\(2\)/)
  await inspector(page).getByTestId('adjust-reset').click()
  await expect(
    page
      .locator('[data-testid="spread-frame"][data-filled="true"] img')
      .first(),
  ).not.toHaveCSS('filter', /brightness/)

  await inspector(page).getByRole('button', { name: 'Caption' }).click()
  await inspector(page).getByTestId('caption-input').fill('By the sea')
  await expect(page.getByTestId('frame-caption')).toHaveText('By the sea')

  await inspector(page).getByRole('button', { name: 'Frame style' }).click()
  await inspector(page).getByRole('button', { name: 'White mat' }).click()
  await expect(inspector(page).getByTestId('style-mat')).toBeVisible()
  await inspector(page).getByTestId('style-new').click()
  await expect(inspector(page).getByTestId('style-uses')).toContainText('1')
})
