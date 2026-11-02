import { writeFileSync } from 'node:fs'
import { type Page, type TestInfo } from '@playwright/test'
import { installPhotoDirectoryPickerStub } from '../fixtures/photoDirectoryPicker'
import { OPEN_PHOTO_HANDLER_LABEL, PERF_BUDGETS } from './budgets'

/** Mirrors `PhotobooksPerfApi` without importing app modules. */
export interface PhotobooksPerfApi {
  clearAll: () => void
  clearLoafEntries: () => void
  getLoafEntries: () => readonly unknown[]
  assertNoLoafEntries: (maxEntries?: number) => void
  isLoafObserving: () => boolean
  stopLoafObserver: () => void
  getFramePacingStats: () => {
    sampleCount: number
    p95Ms: number
    droppedRatio: number
    deltasMs: readonly number[]
  }
  assertFramePacingWithinBudget: (
    budgetP95Ms?: number,
    budgetDroppedRatio?: number,
  ) => void
  isFramePacingSampling: () => boolean
  getEventTimingEntries: () => readonly unknown[]
  flushEventTimingEntries: () => void
  getInpMs: () => number | null
  assertInpWithinBudget: (budgetMs?: number) => void
  isEventTimingObserving: () => boolean
  getHandlerMeasureDurations: (label: string) => number[]
  assertHandlerP95WithinBudget: (label: string, budgetMs?: number) => void
  clearHandlerMeasures: (label?: string) => void
  budgets: typeof PERF_BUDGETS
}

/**
 * Browser-side helpers safe to pass to `page.evaluate`.
 * Each function must be self-contained (Playwright serializes only that body).
 */
export function browserAssertNoLoaf(loafMax: number): void {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  perf.assertNoLoafEntries(loafMax)
}

export function browserClearLoafEntries(): void {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  perf.clearLoafEntries()
}

/**
 * Start a LoAF scenario window after paint settles.
 * Double-rAF + re-clear drops frames that straddled the first clear so they
 * are not attributed to the upcoming interaction (budget stays zero entries).
 * Retries a few quiet settles so import/thumb bursts that land on the clear
 * boundary are not counted before the interaction starts.
 * Must stay self-contained for `page.evaluate` (no outer closures).
 */
export async function browserBeginLoafScenarioWindow(): Promise<void> {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  const waitDoubleRaf = (): Promise<void> =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    perf.clearLoafEntries()
    await waitDoubleRaf()
    if (perf.getLoafEntries().length === 0) {
      perf.clearLoafEntries()
      return
    }
  }
  perf.clearLoafEntries()
}

/**
 * Warm the filmstrip virtualizer, then open a LoAF window.
 * Cold first-scroll mounts must not count toward scroll-during-import LoAF
 * (same pattern as book-titles rename-while-scroll). Reset to scrollLeft 0 so
 * the measured window starts from a known position after the warm-up.
 */
export async function beginFilmstripLoafScrollWindow(
  page: Page,
): Promise<void> {
  await page.getByTestId('filmstrip-item').first().waitFor({
    state: 'visible',
    timeout: 60_000,
  })
  for (let i = 0; i < 5; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 160
    })
    await page.waitForTimeout(32)
  }
  await page.getByTestId('filmstrip-scroll').evaluate((node) => {
    node.scrollLeft = 0
  })
  await page.waitForTimeout(32)
  await page.evaluate(browserBeginLoafScenarioWindow)
}

/** Measured filmstrip scroll steps inside an open LoAF scenario window. */
export async function scrollFilmstripLoafWindow(
  page: Page,
  steps = 30,
): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.getByTestId('filmstrip-scroll').evaluate((node) => {
      node.scrollLeft += 160
    })
    await page.waitForTimeout(32)
  }
}

export interface LoafScriptRow {
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
 * timings). Not buffered: a throttled reload could fill the 200-entry buffer
 * before the scenario window opens. Self-contained for `page.evaluate`.
 */
export function browserStartLoafScripts(): void {
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

/** Rows since `browserStartLoafScripts`; stops that observer. */
export function browserTakeLoafScripts(): LoafScriptRow[] {
  return (window as LoafScriptWindow).__takeLoafScripts?.() ?? []
}

export function browserAssertNoLoafThenClear(): void {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  perf.assertNoLoafEntries(0)
  perf.clearLoafEntries()
}

export function browserAssertNoLoafAndHandlerP95(args: {
  budgetMs: number
  label: string
}): void {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  perf.assertNoLoafEntries(0)
  perf.assertHandlerP95WithinBudget(args.label, args.budgetMs)
}

declare global {
  interface Window {
    __photobooksPerf?: PhotobooksPerfApi
    __photobooksThumbs?: {
      clearThumbsAndDerivedCacheForTests: () => Promise<void>
      getBackgroundWarmStatsForTests: () => {
        encoded: number
        inFlight: number
        settledCount: number
        longestSliceMs: number
      }
      getThumbCacheStatsForTests: () => {
        entries: number
        bytes: number
        pending: number
      }
      getThumbBulkHydrateStatsForTests: () => {
        state: 'idle' | 'running' | 'done'
        hydrated: number
        missed: number
        ms: number
      }
    }
    __photobooksProject?: {
      attachMemoryLibraryForTests: () => Promise<{
        ok: boolean
        code?: string
      }>
      attachOpfsTestLibrary: (
        folderName?: string,
      ) => Promise<{ ok: boolean; code?: string }>
      openOpfsTestLibrary: (
        folderName?: string,
      ) => Promise<{ ok: boolean; code?: string }>
      adoptCurrentBookInLibrary: () => Promise<{ ok: boolean; code?: string }>
      saveBookNow: () => void
      createBookInLibrary: (
        title?: string,
        options?: { trim?: { widthMm: number; heightMm: number } },
      ) => Promise<{
        ok: boolean
        code?: string
        value?: { id: string }
      }>
      createLibrary: () => Promise<{ ok: boolean; code?: string }>
      openLibrary: () => Promise<{ ok: boolean; code?: string }>
      tryRestore: () => Promise<unknown>
      listLibraryBooks: () => Promise<{
        ok: boolean
        code?: string
        value?: readonly { id: string }[]
      }>
      selectRecentLibrary: (libraryId: string) => Promise<{
        ok: boolean
        code?: string
        value?: readonly { id: string }[]
      }>
      openBookFromHome: (
        libraryId: string,
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string }>
      openBookFromLibrary: (
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string }>
      startSessionEditor: () => void
      leaveEditorForLibrary: () => Promise<void>
      chooseLibraryFolder: () => Promise<{ ok: boolean; code?: string }>
      changeLibraryFolder: () => Promise<{ ok: boolean; code?: string }>
      seedHomeRecentsForTests: (count: number) => Promise<void>
      regrantLibrary: () => Promise<{ ok: boolean; code?: string }>
      regrantLibraryWithHandleForTests: (handle?: {
        id: string
      }) => Promise<{ ok: boolean; code?: string }>
      setAccessPhaseForTests: (
        phase: 'idle' | 'permission-required' | 'locked-elsewhere',
      ) => void
      setBookGridForTests: (patch: Record<string, number>) => void
      holdExternalBookLockForTests: (
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string }>
      tryActivateLibraryBookForTests: (
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string; value?: { id: string } }>
      configureProjectSession: (deps: Record<string, unknown>) => void
      getSnapshot: () => unknown
      restorePhotoFolderForActiveBook: () => Promise<void>
      regrantPhotoFolder: () => Promise<
        'granted' | 'denied' | 'unavailable' | 'missing'
      >
      getPhotoRootSessionSnapshot: () => {
        photoAccessPhase: 'idle' | 'permission-required'
        photoFolderLabel: string | null
        hasPhotoFolder: boolean
      }
      setFolderRescanProgressForTests: (
        state: {
          total: number
          completed: number
          running: boolean
          phase: 'priority' | 'lazy'
        } | null,
      ) => void
    }
  }
}

export async function applyCpuThrottling(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', {
    rate: PERF_BUDGETS.cpuThrottleRate,
  })
}

export async function enablePerfScenario(
  page: Page,
  url = '/?perf=1',
): Promise<void> {
  await installPhotoDirectoryPickerStub(page)
  await page.goto(url)
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  const home = page.getByTestId('welcome-screen')
  if (await home.isVisible()) {
    await page
      .getByTestId('welcome-loading')
      .waitFor({ state: 'hidden' })
      .catch(() => undefined)
    await page.evaluate(() => {
      window.__photobooksProject?.startSessionEditor()
    })
    await page.getByTestId('editor-shell').waitFor({ state: 'visible' })
  }
  await applyCpuThrottling(page)
}

export async function clearPerfScenario(page: Page): Promise<void> {
  await page.evaluate(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.clearAll()
  })
}

export async function assertCiPerfGates(page: Page): Promise<void> {
  // Timer budgets scale with CDP CPU throttle (2 ms unthrottled ≈ 4 ms at 2×).
  const handlerBudgetMs =
    PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate
  const inpBudgetMs = PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate
  await page.evaluate(
    ({ handlerLabel, loafMax, handlerBudgetMs, inpBudgetMs }) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(loafMax)
      perf.assertInpWithinBudget(inpBudgetMs)
      perf.assertHandlerP95WithinBudget(handlerLabel, handlerBudgetMs)
    },
    {
      handlerLabel: OPEN_PHOTO_HANDLER_LABEL,
      loafMax: PERF_BUDGETS.loafEntriesMax,
      handlerBudgetMs,
      inpBudgetMs,
    },
  )
}

export async function collectFrameStatsArtifact(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const stats = await page.evaluate(() => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    return perf.getFramePacingStats()
  })

  const hardFramePacing = process.env.PERF_HARD_FRAME_PACING === '1'
  if (hardFramePacing) {
    await page.evaluate(
      ({ budgets }) => {
        const perf = window.__photobooksPerf
        if (!perf) {
          throw new Error('window.__photobooksPerf is not available')
        }
        perf.assertFramePacingWithinBudget(
          budgets.frameP95Ms,
          budgets.droppedFrameRatio,
        )
      },
      { budgets: PERF_BUDGETS },
    )
  }

  const outPath = testInfo.outputPath('perf-frame-stats.json')
  writeFileSync(outPath, JSON.stringify(stats, null, 2), 'utf8')
  await testInfo.attach('perf-frame-stats.json', {
    path: outPath,
    contentType: 'application/json',
  })
}

export async function assertCrossOriginIsolated(page: Page): Promise<void> {
  const isolated = await page.evaluate(() => window.crossOriginIsolated)
  if (!isolated) {
    throw new Error('Expected window.crossOriginIsolated === true')
  }
}
