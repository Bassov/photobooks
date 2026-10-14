import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
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
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('imports PNG into the filmstrip via input fallback', async ({ page }) => {
  await page.goto('/')
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.samplePng)

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
})

test('EXIF orientation 6 shows a filmstrip thumb', async ({ page }) => {
  await page.goto('/')
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.sampleOrient6)

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
})

test('unsupported TIFF shows import error without gallery entry', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles({
    name: 'scan.tiff',
    mimeType: 'image/tiff',
    buffer: Buffer.from('II*\u0000fake'),
  })

  await expect(page.getByTestId('import-errors')).toBeVisible()
  await expect(page.getByTestId('import-errors')).toContainText('Unsupported')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
})

test('second import appends to the gallery', async ({ page }) => {
  await page.goto('/')
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.samplePng)
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })

  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.sampleOrient6)
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
})

test('SPA is cross-origin isolated under preview headers', async ({ page }) => {
  await page.goto('/')
  await assertCrossOriginIsolated(page)
})

function writeBulkImportFixtures(count: number): string[] {
  const dir = join(tmpdir(), `photobooks-bulk-${String(process.pid)}`)
  mkdirSync(dir, { recursive: true })
  // Minimal valid 1×1 PNG
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

test('long gallery scrolls inside the filmstrip without widening the page', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const files = writeBulkImportFixtures(80)

  await page.goto('/')
  await page.getByTestId('photo-file-input').setInputFiles(files)

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe('80')

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')
})

test('bulk filmstrip import while scrolling stays within frame-budget gates', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await enablePerfScenario(page)

  const observing = await page.evaluate(() => {
    return window.__photobooksPerf?.isLoafObserving() ?? false
  })
  expect(observing).toBe(true)

  await clearPerfScenario(page)

  const files = writeBulkImportFixtures(200)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add photos' }).click({ delay: 20 })
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(files)

  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('import-progress')).toContainText('Importing', {
    timeout: 30_000,
  })

  // Progressive visibility: gallery ids flush into the strip before the batch settles.
  await expect
    .poll(
      async () => {
        const count = Number(
          (await page
            .getByTestId('filmstrip')
            .getAttribute('data-gallery-count')) ?? '0',
        )
        const importing = await page.getByTestId('import-progress').isVisible()
        return count > 0 && importing
      },
      { timeout: 60_000 },
    )
    .toBe(true)

  // Interaction window: scroll while import continues (exclude picker/setFiles LoAF).
  await page.evaluate(() => {
    window.__photobooksPerf?.clearLoafEntries()
  })

  for (let i = 0; i < 30; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 160
    })
    await page.waitForTimeout(32)
  }

  // Assert LoAF for the scroll-during-import window before post-import reveal work.
  await page.evaluate(
    ({ loafMax }) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(loafMax)
    },
    { loafMax: 0 },
  )

  // Virtualizer only mounts visible rows — assert gallery size, not DOM item count.
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe('200')

  await assertDocumentFitsViewport(page)

  await expect(page.getByTestId('filmstrip-item').first()).toBeVisible({
    timeout: 60_000,
  })

  await page.waitForFunction(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      return false
    }
    perf.flushEventTimingEntries()
    return perf.getEventTimingEntries().length > 0
  })

  // Clear post-import reveal LoAF; keep INP/handler from the Add photos gesture.
  await page.evaluate(() => {
    window.__photobooksPerf?.clearLoafEntries()
  })

  await assertCiPerfGates(page)
  await collectFrameStatsArtifact(page, testInfo)
})
