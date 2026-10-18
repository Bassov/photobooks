import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

function writeBulkImportFixtures(count: number): string[] {
  const dir = join(tmpdir(), `photobooks-open-save-bulk-${String(process.pid)}`)
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const paths: string[] = []
  for (let i = 0; i < count; i += 1) {
    const path = join(dir, `bulk-${String(i).padStart(3, '0')}.png`)
    writeFileSync(path, png)
    paths.push(path)
  }
  return paths
}

test('empty home offers create and open library without page scroll', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-empty')).toBeVisible()
  await expect(page.getByTestId('create-library')).toBeVisible()
  await expect(page.getByTestId('open-library')).toBeVisible()
  await assertDocumentFitsViewport(page)
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
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
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

  const libraryFolder = `photobooks-e2e-adopt-${String(process.pid)}-${String(Date.now())}`
  const attached = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const result = await api.attachOpfsTestLibrary(folderName)
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.code }
  }, libraryFolder)
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

test('bulk library import reload hydrates thumbs across the filmstrip', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const count = 24
  const files = writeBulkImportFixtures(count)

  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')

  await page.getByTestId('photo-file-input').setInputFiles(files)
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe(String(count))
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 30_000,
  })
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 30_000 },
    )
    .toBe(String(count))

  const scroll = page.getByTestId('filmstrip-scroll')
  const maxScroll = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  // Cover start, mid, and end — late assets are most likely to miss put-before-save.
  for (const left of [0, Math.floor(maxScroll / 2), maxScroll]) {
    await scroll.evaluate((node, nextLeft) => {
      node.scrollLeft = nextLeft
    }, left)
    await expect(page.getByTestId('filmstrip-placeholder')).toHaveCount(0, {
      timeout: 30_000,
    })
    await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
      timeout: 15_000,
    })
  }
})

test('fresh session Open loads saved book with thumbs and frames', async ({
  page,
}) => {
  test.setTimeout(120_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const libraryFolder = `photobooks-e2e-open-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('save-book')).toBeDisabled()

  const attached = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const result = await api.attachOpfsTestLibrary(folderName)
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.code }
  }, libraryFolder)
  expect(attached.ok).toBe(true)
  await expect(page.getByTestId('save-book')).toBeEnabled()
  await page.bringToFront()

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

  await page.bringToFront()
  const first = page.getByTestId('filmstrip-item').nth(0)
  await first.focus()
  await page.keyboard.press('Space')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  const place = page.getByRole('button', { name: 'Place photo' }).first()
  await place.focus()
  await expect(place).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 30_000,
  })

  // Simulate a fresh browser session: no sessionStorage / remembered handles.
  await page.evaluate(async () => {
    sessionStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('photobooks-session')
      request.onsuccess = () => {
        resolve()
      }
      request.onerror = () => {
        reject(request.error ?? new Error('indexedDB delete failed'))
      }
      request.onblocked = () => {
        resolve()
      }
    })
  })
  await page.goto('/')
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('save-book')).toBeDisabled()
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)

  const opened = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.openOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const result = await api.openOpfsTestLibrary(folderName)
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.code }
  }, libraryFolder)
  expect(opened.ok).toBe(true)

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

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

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
