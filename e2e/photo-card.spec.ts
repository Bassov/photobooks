import { expect, test } from '@playwright/test'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

/** Mirrors `PhotobooksPerfApi` without importing app modules into the e2e TS project. */
interface PhotobooksPerfApi {
  clearLoafEntries: () => void
  getLoafEntries: () => readonly unknown[]
  assertNoExcessiveBlocking: (budgetMs?: number) => void
  isLoafObserving: () => boolean
}

declare global {
  interface Window {
    __photobooksPerf?: PhotobooksPerfApi
  }
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: true })
})

test('photo card shows metadata for PNG via input fallback', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.samplePng)

  const card = page.getByTestId('photo-card')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('photo-dimensions')).toHaveText('30×20')
  await expect(page.getByTestId('photo-aspect')).toHaveText('3:2')
  await expect(page.getByTestId('photo-size')).not.toBeEmpty()
  await expect(page.getByTestId('photo-preview')).toBeVisible()
})

test('EXIF orientation 6 swaps corrected dimensions', async ({ page }) => {
  await page.goto('/')
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.sampleOrient6)

  await expect(page.getByTestId('photo-card')).toBeVisible()
  await expect(page.getByTestId('photo-card')).toHaveAttribute(
    'data-orientation',
    '6',
  )
  // Stored 40×20 with Orientation=6 → corrected 20×40, aspect 1:2
  await expect(page.getByTestId('photo-dimensions')).toHaveText('20×40')
  await expect(page.getByTestId('photo-aspect')).toHaveText('1:2')
  await expect(page.getByTestId('photo-preview')).toBeVisible()
})

test('unsupported TIFF shows error', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles({
    name: 'scan.tiff',
    mimeType: 'image/tiff',
    buffer: Buffer.from('II*\u0000fake'),
  })

  await expect(page.getByTestId('photo-error')).toBeVisible()
  await expect(page.getByTestId('photo-error')).toContainText('Unsupported')
  await expect(page.getByTestId('photo-card')).toHaveCount(0)
})

test('24MP JPEG import stays within LoAF budget', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?loaf=1')
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)

  const observing = await page.evaluate(() => {
    return window.__photobooksPerf?.isLoafObserving() ?? false
  })
  expect(observing).toBe(true)

  await page.evaluate(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.clearLoafEntries()
  })

  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.largeJpeg)
  await expect(page.getByTestId('photo-card')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('photo-dimensions')).toHaveText('6000×4000')

  await page.evaluate(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.assertNoExcessiveBlocking(200)
  })
})
