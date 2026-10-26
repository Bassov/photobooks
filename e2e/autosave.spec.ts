import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { expectMissingHatchAfterRestore } from './fixtures/relinkAfterRestore'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

test('clean library-backed book shows Saved without page scroll', async ({
  page,
}) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('save-book')).toBeEnabled({
    timeout: 15_000,
  })
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')
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
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Autosave book')
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')
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

  const templateGroup = page.getByRole('radiogroup', {
    name: 'Template for this spread',
  })
  await templateGroup.getByRole('radio', { name: '2-up' }).click()
  await expect(page.getByTestId('save-indicator')).toHaveText(/Unsaved|Saving/)

  await expect(page.getByTestId('save-indicator')).toHaveText('Saved', {
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
  await expect(
    page
      .getByRole('radiogroup', { name: 'Template for this spread' })
      .getByRole('radio', {
        name: '2-up',
      }),
  ).toBeChecked()
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})
