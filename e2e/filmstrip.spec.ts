import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('empty filmstrip message spans the scrollport', async ({ page }) => {
  await openSessionEditor(page)
  const empty = page.getByTestId('filmstrip-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toHaveText('Add a folder or photos to build the gallery.')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  const box = await empty.boundingBox()
  expect(box).toBeTruthy()
  if (!box) {
    return
  }
  // Bug: 1px virtualizer window stacked one word per line.
  expect(box.width).toBeGreaterThan(240)
  expect(box.height).toBeLessThan(72)
})

test('non-ASCII file name is the filmstrip thumbnail name', async ({
  page,
}) => {
  const fileName = 'фото отпуск 01.jpg'
  await openSessionEditor(page)
  await page.getByTestId('photo-file-input').setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: readFileSync(photoFixturePaths.samplePng),
  })

  const thumb = page.getByRole('row', { name: fileName })
  await expect(thumb).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('row', { name: /^asset-/ })).toHaveCount(0)
  await thumb.click()
  await expect(thumb).toHaveAttribute('aria-selected', 'true')
  await assertDocumentFitsViewport(page)
})

test('imports PNG into the filmstrip via input fallback', async ({ page }) => {
  await openSessionEditor(page)
  await page
    .getByTestId('photo-file-input')
    .setInputFiles(photoFixturePaths.samplePng)

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-count')).toContainText('1 photo')
})

test('portrait and landscape cards differ; thumbs use contain', async ({
  page,
}) => {
  await openSessionEditor(page)
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
  await expect(page.getByTestId('filmstrip-count')).toContainText('2 photos')

  const land = page.locator(
    '[data-testid="filmstrip-item"][data-orientation="landscape"]',
  )
  const port = page.locator(
    '[data-testid="filmstrip-item"][data-orientation="portrait"]',
  )
  await expect(land).toHaveCount(1, { timeout: 30_000 })
  await expect(port).toHaveCount(1, { timeout: 30_000 })

  const landBox = await land.boundingBox()
  const portBox = await port.boundingBox()
  expect(landBox).toBeTruthy()
  expect(portBox).toBeTruthy()
  expect((portBox?.width ?? 0) < (landBox?.width ?? 0)).toBe(true)

  const objectFit = await page
    .getByTestId('filmstrip-thumb')
    .first()
    .evaluate((node) => getComputedStyle(node).objectFit)
  expect(objectFit).toBe('contain')
})

test('portrait gallery fills the scrollport while scrolling', async ({
  page,
}) => {
  test.setTimeout(120_000)
  // Many identical portraits — fixed WINDOW_SIZE left a hole on wide viewports.
  const files = Array.from(
    { length: 36 },
    () => photoFixturePaths.sampleOrient6,
  )
  await openSessionEditor(page)
  await page.getByTestId('photo-file-input').setInputFiles(files)

  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe('36')

  const scroll = page.getByTestId('filmstrip-scroll')
  const maxScroll = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  expect(maxScroll).toBeGreaterThan(0)

  // Mid-scroll is the regression: fixed WINDOW_SIZE left a hole while more
  // cards still exist to the right. End-of-strip may legitimately not fill.
  for (const left of [0, Math.floor(maxScroll / 2)]) {
    await scroll.evaluate((node, nextLeft) => {
      node.scrollLeft = nextLeft
    }, left)
    await page.waitForTimeout(50)

    const coverage = await page.evaluate(() => {
      const port = document.querySelector('[data-testid="filmstrip-scroll"]')
      if (!(port instanceof HTMLElement)) {
        return { ok: false, reason: 'no-scrollport' }
      }
      const portBox = port.getBoundingClientRect()
      const items = Array.from(
        document.querySelectorAll('[data-testid="filmstrip-item"]'),
      )
      if (items.length === 0) {
        return { ok: false, reason: 'no-items' }
      }
      let maxRight = 0
      for (const el of items) {
        const box = el.getBoundingClientRect()
        if (box.right > maxRight) {
          maxRight = box.right
        }
      }
      // Rightmost mounted card should reach near the scrollport's right edge
      // (allow scrollbar / padding slack). A fixed 16-item window leaves >400px.
      const hole = portBox.right - maxRight
      return { ok: hole < 120, hole, itemCount: items.length }
    })

    expect(coverage.ok, JSON.stringify(coverage)).toBe(true)
  }
})

test('mixed aspect cards pack with uniform gaps from each card end', async ({
  page,
}) => {
  await openSessionEditor(page)
  // Two landscapes then three portraits — fixed max-width stride leaves huge gaps
  // between portraits (see aspect filmstrip packing bug).
  await page
    .getByTestId('photo-file-input')
    .setInputFiles([
      photoFixturePaths.samplePng,
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
      photoFixturePaths.sampleOrient6,
      photoFixturePaths.sampleOrient6,
    ])

  await expect(page.getByTestId('filmstrip-item')).toHaveCount(5, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(5, {
    timeout: 30_000,
  })
  await expect(
    page.locator(
      '[data-testid="filmstrip-item"][data-orientation="landscape"]',
    ),
  ).toHaveCount(2, { timeout: 30_000 })
  await expect(
    page.locator('[data-testid="filmstrip-item"][data-orientation="portrait"]'),
  ).toHaveCount(3, { timeout: 30_000 })

  const gaps = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('[data-testid="filmstrip-item"]'),
    )
    const boxes = items.map((el) => el.getBoundingClientRect())
    const nextGaps: number[] = []
    for (let i = 1; i < boxes.length; i += 1) {
      const prev = boxes[i - 1]
      const curr = boxes[i]
      if (!prev || !curr) {
        continue
      }
      nextGaps.push(curr.left - prev.right)
    }
    return nextGaps
  })

  expect(gaps).toHaveLength(4)
  const expectedGap = gaps[0] ?? 0
  for (const gap of gaps) {
    expect(Math.abs(gap - expectedGap)).toBeLessThan(2)
  }
  // Flex gap is 8px; max-width stride leftovers are ~96px between portraits.
  expect(expectedGap).toBeGreaterThan(4)
  expect(expectedGap).toBeLessThan(20)
})

test('EXIF orientation 6 shows a filmstrip thumb', async ({ page }) => {
  await openSessionEditor(page)
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
  await openSessionEditor(page)
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
  await openSessionEditor(page)
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
  await openSessionEditor(page)
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

test('bulk import fills every revealed placeholder even while scrolling', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const count = 24
  const files = writeBulkImportFixtures(count)

  await openSessionEditor(page)
  await page.getByTestId('photo-file-input').setInputFiles(files)

  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 30_000,
  })

  // Shift the visible window during import — must not cancel off-screen decode.
  for (let i = 0; i < 20; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 120
    })
    await page.waitForTimeout(32)
  }

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

  const scroll = page.getByTestId('filmstrip-scroll')
  const maxScroll = await scroll.evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  for (let left = 0; left <= maxScroll; left += 160) {
    await scroll.evaluate((node, nextLeft) => {
      node.scrollLeft = nextLeft
    }, left)
    await expect(page.getByTestId('filmstrip-placeholder')).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('filmstrip-thumb').first()).toBeVisible({
      timeout: 15_000,
    })
  }
})

test('long gallery scrolls inside the filmstrip without widening the page', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const files = writeBulkImportFixtures(80)

  await openSessionEditor(page)
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

test.describe('frame-budget gates', () => {
  // CPU-sensitive under parallel local workers; CI uses workers: 1. Pre-push is
  // verify:fast only.
  test.describe.configure({ retries: 2 })

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
    await expect(page.getByTestId('import-progress')).toContainText(
      'Importing',
      {
        timeout: 30_000,
      },
    )

    // Progressive visibility: gallery ids flush into the strip before the batch settles.
    await expect
      .poll(
        async () => {
          const count = Number(
            (await page
              .getByTestId('filmstrip')
              .getAttribute('data-gallery-count')) ?? '0',
          )
          const importing = await page
            .getByTestId('import-progress')
            .isVisible()
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
})
