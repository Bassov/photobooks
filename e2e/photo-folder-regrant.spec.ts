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

test('folder-rescan-progress testid is wired on the filmstrip status strip', async ({
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

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return typeof window.__photobooksProject
          ?.setFolderRescanProgressForTests
      })
    })
    .toBe('function')

  await page.evaluate(() => {
    window.__photobooksProject?.setFolderRescanProgressForTests({
      total: 8,
      completed: 2,
      running: true,
      phase: 'priority',
    })
  })

  await expect(page.getByTestId('folder-rescan-progress')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByTestId('folder-rescan-progress')).toHaveText(
    /Checking photos 2 \/ 8/,
  )

  await page.evaluate(() => {
    window.__photobooksProject?.setFolderRescanProgressForTests(null)
  })
  await expect(page.getByTestId('folder-rescan-progress')).toHaveCount(0, {
    timeout: 10_000,
  })
})
