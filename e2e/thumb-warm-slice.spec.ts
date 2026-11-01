import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
} from './perf/perfFixture'

/**
 * Gallery size where one unsliced warm pass (sync identity digest + queue
 * scan per asset) ran 55–97 ms under the 2× throttle.
 */
const COUNT = 1000
/** A long task starts at 50 ms; one warm slice must stay far below it. */
const LONG_TASK_MS = 50

/**
 * `COUNT` copies of the 3×2 sample PNG in a real OPFS directory as the photo
 * folder: its handle survives IDB structured clone, so reload restores folder
 * access without a relink prompt.
 */
async function pickOpfsPhotoFolder(page: Page): Promise<void> {
  const base64 = readFileSync(photoFixturePaths.samplePng).toString('base64')
  await page.evaluate(
    async ({ count, base64 }) => {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('warm-slice-photos', {
        create: true,
      })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      for (let i = 0; i < count; i += 1) {
        const name = `slice-${String(i).padStart(4, '0')}.png`
        const handle = await dir.getFileHandle(name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(bytes)
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: () => Promise.resolve(dir),
      })
    },
    { count: COUNT, base64 },
  )
  await page.getByTestId('film-add-folder').click()
}

async function warmStats(page: Page) {
  return page.evaluate(() => {
    const api = window.__photobooksThumbs
    if (api === undefined) {
      throw new Error('__photobooksThumbs missing')
    }
    return api.getBackgroundWarmStatsForTests()
  })
}

/** Import `COUNT` photos, wait until the warm lane settled all, save. */
async function saveWarmedBook(page: Page): Promise<void> {
  await createBookViaLibrary(page, 'Warm slice')
  await pickOpfsPhotoFolder(page)
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(COUNT),
    { timeout: 240_000 },
  )
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 120_000,
  })
  await expect
    .poll(async () => (await warmStats(page)).settledCount, {
      timeout: 180_000,
    })
    .toBe(COUNT)
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })
}

/** Scroll the strip to the end and back, one step per frame. */
async function browserFlingStrip(step: number): Promise<number> {
  const node = document.querySelector('[data-testid="filmstrip-scroll"]')
  if (!(node instanceof HTMLElement)) {
    throw new Error('filmstrip-scroll missing')
  }
  let frames = 0
  for (const direction of [1, -1]) {
    for (let guard = 0; guard < 2000; guard += 1) {
      const before = node.scrollLeft
      node.scrollLeft += direction * step
      await new Promise((resolve) => requestAnimationFrame(resolve))
      frames += 1
      if (node.scrollLeft === before) {
        break
      }
    }
  }
  return frames
}

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test.describe('frame-budget gates', () => {
  test('reopen with a cold warm lane, fling the strip: warm slices stay short, 0 LoAF', async ({
    page,
  }) => {
    test.setTimeout(420_000)
    await page.goto('/?testLibrary=1&perf=1')
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
      timeout: 15_000,
    })
    await saveWarmedBook(page)

    await applyCpuThrottling(page)
    await page.reload()
    await expect(page.getByTestId('editor-status')).toHaveText(
      'Book restored',
      { timeout: 60_000 },
    )
    const restoredAt = Date.now()
    await expect(page.getByTestId('filmstrip')).toHaveAttribute(
      'data-gallery-count',
      String(COUNT),
      { timeout: 60_000 },
    )
    // Same rate again in case the reload dropped the emulation.
    await applyCpuThrottling(page)
    // The cold lane re-checks every asset after reload: fling meanwhile.
    await expect
      .poll(async () => (await warmStats(page)).settledCount, {
        intervals: [16],
        timeout: 60_000,
      })
      .toBeGreaterThan(0)
    expect((await warmStats(page)).settledCount).toBeLessThan(COUNT)
    // Attribution first, so every entry the gate counts is also logged.
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    const frames = await page.evaluate(browserFlingStrip, 480)
    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `thumb-warm-slice loaf: ${String(rows.length)} entries ${JSON.stringify(rows)}`,
    )
    expect(frames).toBeGreaterThan(10)
    await page.evaluate(browserAssertNoLoaf, 0)

    await expect
      .poll(async () => (await warmStats(page)).settledCount, {
        intervals: [100],
        timeout: 240_000,
      })
      .toBe(COUNT)
    const stats = await warmStats(page)
    console.log(
      `thumb-warm-slice warm: settled ${String(COUNT)} in ${String(Date.now() - restoredAt)} ms after restore, longest slice ${stats.longestSliceMs.toFixed(1)} ms`,
    )
    expect(stats.longestSliceMs).toBeLessThan(LONG_TASK_MS)
  })
})
