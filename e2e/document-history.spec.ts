import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('undo / redo are disabled on an untouched book', async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('undo')).toBeDisabled()
  await expect(page.getByTestId('redo')).toBeDisabled()
  await assertDocumentFitsViewport(page)
})

test('a placement is one step: toolbar and shortcuts undo and redo it', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await applyLayout(page, '4-grid')
  await dragPlaceFirstFilmstripItem(page, 0)
  const images = page.getByTestId('spread-frame-image')
  await expect(images).toHaveCount(1, { timeout: 30_000 })

  await page.getByTestId('undo').click()
  await expect(images).toHaveCount(0)
  await expect(page.getByTestId('redo')).toBeEnabled()

  await page.getByTestId('redo').click()
  await expect(images).toHaveCount(1)

  await page.keyboard.press('Control+z')
  await expect(images).toHaveCount(0)
  await page.keyboard.press('Control+Shift+z')
  await expect(images).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})
