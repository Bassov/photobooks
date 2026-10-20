import { readFileSync } from 'node:fs'
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
  replaceRelinkStatuses: (
    next: Iterable<[string, 'missing' | 'modified' | 'ok']>,
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

  const pngBase64 = readFileSync(photoFixturePaths.samplePng).toString('base64')
  await page.evaluate(async (b64) => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const file = new File([bytes], 'sample-3x2.png', {
      type: 'image/png',
      lastModified: Date.now(),
    })
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'sample-3x2.png',
    })
    await api.rescanRelinkFiles([file])
  }, pngBase64)

  await expect
    .poll(
      async () =>
        page.getByTestId('relink-row').first().getAttribute('data-status'),
      { timeout: 30_000 },
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
    const rows: [string, 'missing'][] = Array.from(
      { length: 24 },
      (_, index) => [`missing-${String(index)}`, 'missing'],
    )
    api.replaceRelinkStatuses(rows)
    api.setRelinkDialogOpen(true)
  })
  await expect(page.getByTestId('relink-dialog')).toBeVisible()
  await expect(page.getByTestId('relink-row').first()).toBeVisible()
  await assertNamedScrollport(page, 'relink-list', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })

  await page.evaluate(() => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) {
      throw new Error('relink API missing')
    }
    const files = Array.from({ length: 24 }, (_, index) => {
      const bytes = new Uint8Array(1024)
      bytes[0] = index & 0xff
      const file = new File([bytes], `rescan-${String(index)}.bin`, {
        type: 'application/octet-stream',
        lastModified: 1_700_000_000_000 + index,
      })
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `folder/rescan-${String(index)}.bin`,
      })
      return file
    })
    void api.rescanRelinkFiles(files)
  })

  await expect(page.getByTestId('relink-scan-progress')).toBeVisible({
    timeout: 15_000,
  })
  await page.waitForTimeout(100)
  await page.evaluate(browserClearLoafEntries)

  for (let i = 0; i < 12; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 80
    })
    await page.waitForTimeout(48)
  }

  await page.evaluate(browserAssertNoLoaf, 0)

  await page.getByTestId('relink-skip').click()
  await expect(page.getByTestId('relink-dialog')).toHaveCount(0)
  await expect(page.getByTestId('missing-assets-pill')).toBeVisible()
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll', {
    axis: 'horizontal',
    nudgeHorizontal: true,
  })
})
