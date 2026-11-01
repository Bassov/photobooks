import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { browserFlingAndProbe, FLING_STEP_PX } from './fixtures/filmstripFling'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
} from './perf/perfFixture'

const COUNT = 400

/**
 * `COUNT` copies of the 3×2 sample PNG in a real OPFS directory as the photo
 * folder: unlike the picker double, its handle survives IDB structured
 * clone, so reload restores folder access. (A 1×1 image never counts as
 * known dims, so each hydrate would re-derive its aspect.)
 */
async function pickOpfsPhotoFolder(page: Page): Promise<void> {
  ensurePhotoFixtures()
  const base64 = readFileSync(photoFixturePaths.samplePng).toString('base64')
  await page.evaluate(
    async ({ count, base64 }) => {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('bulk-hydrate-photos', {
        create: true,
      })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      for (let i = 0; i < count; i += 1) {
        const name = `bulk-${String(i).padStart(4, '0')}.png`
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

interface LoafScriptRow {
  start: number
  blocking: number
  scripts: {
    url: string
    fn: string
    /** Char offset of `fn` in the (minified) bundle. */
    pos: number
    invoker: string
    duration: number
  }[]
}

type LoafScriptWindow = Window & {
  __takeLoafScripts?: () => LoafScriptRow[]
}

/**
 * Live LoAF observer with per-script attribution (the perf module keeps only
 * timings). Not buffered: the throttled reload could fill the 200-entry
 * buffer before the scenario window opens.
 */
function browserStartLoafScripts(): void {
  interface ScriptTiming {
    sourceURL?: string
    sourceFunctionName?: string
    sourceCharPosition?: number
    invoker?: string
    duration: number
  }
  interface LoafTiming extends PerformanceEntry {
    blockingDuration?: number
    scripts?: ScriptTiming[]
  }
  const rows: LoafScriptRow[] = []
  const ingest = (entries: PerformanceEntryList) => {
    for (const entry of entries as LoafTiming[]) {
      rows.push({
        start: Math.round(entry.startTime),
        blocking: Math.round(entry.blockingDuration ?? 0),
        scripts: (entry.scripts ?? []).map((script) => ({
          url: script.sourceURL ?? '',
          fn: script.sourceFunctionName ?? '',
          pos: script.sourceCharPosition ?? -1,
          invoker: script.invoker ?? '',
          duration: Math.round(script.duration),
        })),
      })
    }
  }
  const observer = new PerformanceObserver((list) => {
    ingest(list.getEntries())
  })
  observer.observe({ type: 'long-animation-frame' })
  ;(window as LoafScriptWindow).__takeLoafScripts = () => {
    ingest(observer.takeRecords())
    observer.disconnect()
    return rows
  }
}

function browserTakeLoafScripts(): LoafScriptRow[] {
  return (window as LoafScriptWindow).__takeLoafScripts?.() ?? []
}

function thumbStats(page: Page) {
  return page.evaluate(() => {
    const api = window.__photobooksThumbs
    if (!api) {
      throw new Error('window.__photobooksThumbs is not available')
    }
    const { entries, pending } = api.getThumbCacheStatsForTests()
    const { state, missed } = api.getThumbBulkHydrateStatsForTests()
    return { entries, pending, state, missed }
  })
}

/** New library book, import `COUNT` photos, every thumb cached, then save. */
async function saveBookWithCachedThumbs(page: Page): Promise<void> {
  page.once('dialog', (dialog) => {
    void dialog.accept('Bulk hydrate')
  })
  await createBookViaLibrary(page)
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
    .poll(async () => (await thumbStats(page)).entries, { timeout: 120_000 })
    .toBe(COUNT)
  // Save awaits the DerivedCache puts, so reload finds every thumb.
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })
}

async function reloadUntilRestored(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 60_000,
  })
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(COUNT),
    { timeout: 60_000 },
  )
}

test('reload hydrates every cached thumb; a fling shows no placeholder', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await saveBookWithCachedThumbs(page)

  await reloadUntilRestored(page)
  // Hydrate-done seam: no tile was scrolled into view, yet all are hot.
  await expect
    .poll(() => thumbStats(page), { timeout: 60_000 })
    .toEqual({ entries: COUNT, pending: 0, state: 'done', missed: 0 })

  const probe = await page.evaluate(browserFlingAndProbe, FLING_STEP_PX)
  console.log(`thumb-bulk-hydrate probe: ${JSON.stringify(probe)}`)
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
  test('reload then immediate filmstrip scroll while hydrate runs stays at 0 LoAF', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    await page.goto('/?testLibrary=1&perf=1')
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await applyCpuThrottling(page)
    await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
      timeout: 15_000,
    })
    await saveBookWithCachedThumbs(page)

    await reloadUntilRestored(page)
    // Same rate again in case the reload dropped the emulation.
    await applyCpuThrottling(page)
    await expect
      .poll(async () => (await thumbStats(page)).state, {
        intervals: [16],
        timeout: 30_000,
      })
      .toBe('running')
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(browserStartLoafScripts)
    const probe = await page.evaluate(browserFlingAndProbe, FLING_STEP_PX)
    console.log(`thumb-bulk-hydrate perf probe: ${JSON.stringify(probe)}`)
    const loaf = await page.evaluate(
      () => window.__photobooksPerf?.getLoafEntries().length ?? -1,
    )
    console.log(`thumb-bulk-hydrate perf loaf: ${String(loaf)}`)
    const attribution = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `thumb-bulk-hydrate perf loaf scripts: ${JSON.stringify(attribution)}`,
    )
    await page.evaluate(browserAssertNoLoaf, 0)
    // The pass still finishes after the scroll.
    await expect
      .poll(() => thumbStats(page), { timeout: 60_000 })
      .toMatchObject({ entries: COUNT, state: 'done' })
  })
})
