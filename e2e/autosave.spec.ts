import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { chooseZoom } from './fixtures/zoomMenu'
import { expectMissingHatchAfterRestore } from './fixtures/relinkAfterRestore'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import { applyLayout, layoutTile, openSpreadTab } from './fixtures/layoutTiles'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

import { createBookViaLibrary } from './fixtures/createBookViaLibrary'

test('clean library-backed book shows Saved without page scroll', async ({
  page,
}) => {
  // Short enough that the tight dock still leaves the pasteboard scrolling.
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('book-size')).toHaveText(/· saved$/)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('autosave persists edits across reload without manual Save', async ({
  page,
}) => {
  test.setTimeout(90_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await installPhotoDirectoryPickerStub(page)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Autosave book')
  })
  await createBookViaLibrary(page)
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await expect(page.getByTestId('book-size')).toHaveText(/· saved$/)
  await page.bringToFront()

  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await page.bringToFront()
  await dragPlaceFirstFilmstripItem(page)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

  await applyLayout(page, '2-up')
  await expect(page.getByTestId('book-size')).toHaveText(/· (unsaved|saving…)$/)

  await expect(page.getByTestId('book-size')).toHaveText(/· saved$/, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 20_000,
  })
  await expectMissingHatchAfterRestore(page, 1)
  await openSpreadTab(page)
  await expect(layoutTile(page, '2-up')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('book-size')).toHaveText(/· saved$/)

  await assertDocumentFitsViewport(page)
  // Fit shows the whole spread, so overflow needs a deterministic zoom-in.
  await chooseZoom(page, '200%')
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})
