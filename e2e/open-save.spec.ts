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
  await expect(page.getByTestId('save-book')).toBeEnabled()
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

test('session import then attach library saves without New book; reload hydrates', async ({
  page,
}) => {
  test.setTimeout(120_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/')
  await expect(page.getByTestId('save-book')).toBeDisabled()

  await page
    .getByTestId('photo-file-input')
    .setInputFiles([
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
    ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })

  const first = page.getByTestId('filmstrip-item').nth(0)
  await page.bringToFront()
  await first.focus()
  await page.keyboard.press('Space')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  const place = page.getByRole('button', { name: 'Place photo' }).first()
  await place.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

  const attached = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const result = await api.attachOpfsTestLibrary()
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.code }
  })
  expect(attached.ok).toBe(true)
  await expect(page.getByTestId('save-book')).toBeEnabled()
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Book created in library',
  )

  page.once('dialog', (dialog) => {
    void dialog.dismiss()
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1)
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 30_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 20_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(
    page.locator(
      '[data-testid="filmstrip-item"][data-orientation="landscape"]',
    ),
  ).toHaveCount(1, { timeout: 15_000 })
  // Landscape filmstrip orientation after reload proves aspect was restored
  // from hydrated preview (not forced to square sessionMeta default).

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('New book confirm accept replaces content with an empty book', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('save-book')).toBeEnabled({ timeout: 15_000 })

  await page
    .getByTestId('photo-file-input')
    .setInputFiles([photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })

  page.once('dialog', (dialog) => {
    void dialog.accept()
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
})
