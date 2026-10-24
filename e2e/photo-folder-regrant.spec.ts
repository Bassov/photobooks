import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

test('Allow access re-grants the photo folder without a new picker', async ({
  page,
}) => {
  test.setTimeout(90_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await installPhotoDirectoryPickerStub(page)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Book created in library',
  )

  await choosePhotoFolder(page, [photoFixturePaths.samplePng], {
    via: 'picker',
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })

  await page.evaluate(() => {
    const handle = (
      window as Window & {
        __pbLastPhotoDir?: { setPermission?: (state: PermissionState) => void }
      }
    ).__pbLastPhotoDir
    if (handle?.setPermission === undefined) {
      throw new Error('photo directory stub handle missing setPermission')
    }
    handle.setPermission('prompt')
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.restorePhotoFolderForActiveBook) {
      throw new Error('restorePhotoFolderForActiveBook is not available')
    }
    await api.restorePhotoFolderForActiveBook()
  })

  const allow = page.getByTestId('regrant-photo-folder')
  await expect(allow).toBeVisible({ timeout: 15_000 })
  await expect(allow).toHaveText(/Allow access to /i)
  await allow.click()
  await expect(allow).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
})
