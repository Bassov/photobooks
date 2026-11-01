import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

const COUNT = 400
/** Per-frame scrollLeft step: several slots per frame (a fling, not a nudge). */
const FLING_STEP_PX = 240

/** `count` 1×1 PNGs under distinct names (identity-first: one tile each). */
function writeSmallPngFolder(count: number): string[] {
  const dir = join(
    tmpdir(),
    `photobooks-hot-${String(process.pid)}-${String(count)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const files: string[] = []
  for (let i = 0; i < count; i += 1) {
    const path = join(dir, `hot-${String(i).padStart(4, '0')}.png`)
    writeFileSync(path, png)
    files.push(path)
  }
  return files
}

/** Import `files`, then wait until every thumb is in the hot cache. */
async function importAndWaitForThumbs(
  page: Page,
  files: readonly string[],
): Promise<void> {
  await choosePhotoFolder(page, files)
  await expect
    .poll(
      async () =>
        page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 240_000 },
    )
    .toBe(String(files.length))
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 120_000,
  })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__photobooksThumbs
          if (!api) {
            throw new Error('window.__photobooksThumbs is not available')
          }
          const { entries, pending } = api.getThumbCacheStatsForTests()
          return { entries, pending }
        }),
      { timeout: 120_000 },
    )
    .toEqual({ entries: files.length, pending: 0 })
}

/**
 * Fling the strip 0 → end → 0 → end, one `step` of scrollLeft per frame.
 * Each rAF first samples what the previous frame painted: placeholders whose
 * box intersects the scrollport. Self-contained for `page.evaluate`.
 */
async function browserFlingAndProbe(step: number): Promise<{
  frames: number
  placeholderFrames: number
  maxPlaceholders: number
}> {
  const port = document.querySelector<HTMLElement>(
    '[data-testid="filmstrip-scroll"]',
  )
  if (!port) {
    throw new Error('filmstrip-scroll missing')
  }
  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  let frames = 0
  let placeholderFrames = 0
  let maxPlaceholders = 0
  const sample = (): void => {
    const view = port.getBoundingClientRect()
    let visible = 0
    for (const node of port.querySelectorAll(
      '[data-testid="filmstrip-placeholder"]',
    )) {
      const box = node.getBoundingClientRect()
      if (
        box.right > view.left &&
        box.left < view.right &&
        box.bottom > view.top &&
        box.top < view.bottom
      ) {
        visible += 1
      }
    }
    frames += 1
    if (visible > 0) {
      placeholderFrames += 1
    }
    maxPlaceholders = Math.max(maxPlaceholders, visible)
  }
  const end = port.scrollWidth - port.clientWidth
  const legs = [end, 0, end]
  for (const target of legs) {
    for (;;) {
      await nextFrame()
      sample()
      const left = port.scrollLeft
      if (left === target) {
        break
      }
      port.scrollLeft =
        target > left ? Math.min(target, left + step) : Math.max(0, left - step)
    }
  }
  // Settle: the last scroll commit and its paint are sampled too.
  for (let i = 0; i < 4; i += 1) {
    await nextFrame()
    sample()
  }
  return { frames, placeholderFrames, maxPlaceholders }
}

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('fling over cached thumbs never shows a placeholder in the scrollport', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await openSessionEditor(page)
  await importAndWaitForThumbs(page, writeSmallPngFolder(COUNT))

  const probe = await page.evaluate(browserFlingAndProbe, FLING_STEP_PX)
  console.log(`thumb-hot-cache probe: ${JSON.stringify(probe)}`)

  expect(probe.frames).toBeGreaterThan(100)
  expect(probe.placeholderFrames).toBe(0)
  expect(probe.maxPlaceholders).toBe(0)
  // The fling ends at the far end; the scrollport nudge needs room to move.
  await page.getByTestId('filmstrip-scroll').evaluate((node) => {
    node.scrollLeft = 0
  })
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'filmstrip-scroll')
})

test.describe('frame-budget gates', () => {
  test('fast scroll back over seen tiles stays at 0 LoAF', async ({ page }) => {
    test.setTimeout(300_000)
    await enablePerfScenario(page)
    await clearPerfScenario(page)
    await importAndWaitForThumbs(page, writeSmallPngFolder(COUNT))

    await page.evaluate(browserBeginLoafScenarioWindow)
    const probe = await page.evaluate(browserFlingAndProbe, FLING_STEP_PX)
    console.log(`thumb-hot-cache perf probe: ${JSON.stringify(probe)}`)
    const loaf = await page.evaluate(
      () => window.__photobooksPerf?.getLoafEntries().length ?? -1,
    )
    console.log(`thumb-hot-cache perf loaf: ${String(loaf)}`)
    await page.evaluate(browserAssertNoLoaf, 0)
    expect(probe.placeholderFrames).toBe(0)
  })
})
