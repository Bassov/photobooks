import { expect, test } from '@playwright/test'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  assertCiPerfGates,
  assertCrossOriginIsolated,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

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

test('SPA is cross-origin isolated under preview headers', async ({ page }) => {
  await page.goto('/')
  await assertCrossOriginIsolated(page)
})

test('24MP JPEG import stays within frame-budget gates', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await enablePerfScenario(page)

  const observing = await page.evaluate(() => {
    return window.__photobooksPerf?.isLoafObserving() ?? false
  })
  expect(observing).toBe(true)

  await clearPerfScenario(page)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open photo' }).click({ delay: 20 })
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(photoFixturePaths.largeJpeg)

  await expect(page.getByTestId('photo-card')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('photo-dimensions')).toHaveText('6000×4000')

  await page.waitForFunction(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      return false
    }
    perf.flushEventTimingEntries()
    return perf.getEventTimingEntries().length > 0
  })

  await assertCiPerfGates(page)
  await collectFrameStatsArtifact(page, testInfo)
})
