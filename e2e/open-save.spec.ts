import { expect, test } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

test('empty chrome offers create and open library without page scroll', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('create-library')).toBeVisible()
  await expect(page.getByTestId('open-library')).toBeVisible()
  await expect(page.getByTestId('create-book')).toBeDisabled()
  await expect(page.getByTestId('save-book')).toBeDisabled()
  await assertDocumentFitsViewport(page)
  // Pasteboard hosts three empty spreads; filmstrip empty state does not overflow.
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('save, reload, and restore keep gallery ids', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await expect(page.getByTestId('save-book')).toBeEnabled()

  await page
    .getByTestId('photo-file-input')
    .setInputFiles([
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
    ])
  await expect
    .poll(async () => page.getByTestId('filmstrip-item').count())
    .toBeGreaterThanOrEqual(2)

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })

  const galleryBefore = await page.getByTestId('filmstrip-item').count()

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect
    .poll(async () => page.getByTestId('filmstrip-item').count())
    .toBe(galleryBefore)

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})
