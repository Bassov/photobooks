import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  browserAssertNoLoaf,
  browserClearLoafEntries,
} from './perf/perfFixture'

interface RelinkTestApi {
  detectMissingAssets: (options?: { openDialog?: boolean }) => {
    missing: number
  }
  rescanRelinkFiles: (files: readonly File[]) => Promise<unknown>
  resetRelinkStore: () => void
  setRelinkDialogOpen: (open: boolean) => void
  setRelinkProgress: (
    next: {
      total: number
      completed: number
      running: boolean
    } | null,
  ) => void
  clearLiveAssetSources: () => void
}

async function waitForRelinkApi(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __photobooksRelink?: RelinkTestApi })
        .__photobooksRelink !== undefined,
    { timeout: 15_000 },
  )
}

test('empty relink dialog shows everything linked', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await waitForRelinkApi(page)

  await page.evaluate(() => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    api.resetRelinkStore()
    api.setRelinkDialogOpen(true)
  })

  await expect(page.getByTestId('relink-dialog')).toBeVisible()
  await expect(page.getByTestId('relink-empty')).toHaveText(
    'Everything is linked.',
  )
  await assertDocumentFitsViewport(page)
})

test('rescan by hash then Resolve clears missing pill', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Relink book')
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')

  await page
    .getByTestId('photo-file-input')
    .setInputFiles([photoFixturePaths.samplePng])
  await expect
    .poll(async () => page.getByTestId('filmstrip-item').count())
    .toBeGreaterThanOrEqual(1)

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await waitForRelinkApi(page)

  await expect(page.getByTestId('relink-dialog')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('missing-assets-pill')).toBeVisible()
  await expect(page.getByTestId('relink-row').first()).toHaveAttribute(
    'data-status',
    'missing',
  )

  // webkitdirectory inputs require a directory path in Playwright.
  await page
    .getByTestId('relink-folder-input')
    .setInputFiles(photoFixturePaths.dir)

  await expect
    .poll(async () =>
      page.getByTestId('relink-row').first().getAttribute('data-status'),
    )
    .toBe('found')

  await page.getByTestId('relink-resolve').click()
  await expect(page.getByTestId('relink-dialog')).toHaveCount(0, {
    timeout: 10_000,
  })
  await expect(page.getByTestId('missing-assets-pill')).toHaveCount(0)

  await assertDocumentFitsViewport(page)
})

test('filmstrip scrolls during rescan without page scroll', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1&perf=1')
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Rescan loaf')
  })
  await page.getByTestId('create-book').click()

  const many = Array.from({ length: 24 }, () => photoFixturePaths.samplePng)
  await page.getByTestId('photo-file-input').setInputFiles(many)
  await expect
    .poll(async () => page.getByTestId('filmstrip-item').count())
    .toBeGreaterThanOrEqual(12)

  await waitForRelinkApi(page)
  await page.evaluate(() => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    api.clearLiveAssetSources()
    api.detectMissingAssets({ openDialog: true })
  })
  await expect(page.getByTestId('relink-dialog')).toBeVisible()
  await expect(page.getByTestId('relink-row').first()).toBeVisible()

  // Hold the scan-progress chrome open (rAF-batched store) while scrolling —
  // mirrors the filmstrip import LoAF window without main-thread seed/hash.
  await page.evaluate(() => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    api.setRelinkProgress({ total: 64, completed: 8, running: true })
  })
  await expect(page.getByTestId('relink-scan-progress')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(browserClearLoafEntries)

  for (let i = 0; i < 30; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 160
    })
    await page.waitForTimeout(32)
  }

  await page.evaluate(browserAssertNoLoaf, 0)

  await page.getByTestId('relink-skip').click()
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll', {
    axis: 'horizontal',
    nudgeHorizontal: true,
  })
})
