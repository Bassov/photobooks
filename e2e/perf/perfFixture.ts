import { writeFileSync } from 'node:fs'
import { type Page, type TestInfo } from '@playwright/test'
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

declare global {
  interface Window {
    __photobooksPerf?: PhotobooksPerfApi
    __photobooksProject?: {
      attachMemoryLibraryForTests: () => Promise<unknown>
      attachOpfsTestLibrary: (
        folderName?: string,
      ) => Promise<{ ok: boolean; code?: string }>
      openOpfsTestLibrary: (
        folderName?: string,
      ) => Promise<{ ok: boolean; code?: string }>
      adoptCurrentBookInLibrary: () => Promise<{ ok: boolean; code?: string }>
      saveBookNow: () => void
      createBookInLibrary: () => Promise<{
        ok: boolean
        code?: string
        value?: { id: string }
      }>
      tryRestore: () => Promise<unknown>
      listRecents: () => Promise<readonly { id: string; label: string }[]>
      selectRecentLibrary: (
        libraryId: string,
      ) => Promise<{
        ok: boolean
        code?: string
        value?: readonly { id: string }[]
      }>
      openBookFromHome: (
        libraryId: string,
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string }>
      startSessionEditor: () => void
      seedHomeRecentsForTests: (count: number) => Promise<void>
      regrantLibrary: () => Promise<{ ok: boolean; code?: string }>
      regrantLibraryWithHandleForTests: (handle?: {
        id: string
      }) => Promise<{ ok: boolean; code?: string }>
      setAccessPhaseForTests: (
        phase: 'idle' | 'permission-required' | 'locked-elsewhere',
      ) => void
      holdExternalBookLockForTests: (
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string }>
      tryActivateLibraryBookForTests: (
        bookId: string,
      ) => Promise<{ ok: boolean; code?: string; value?: { id: string } }>
      configureProjectSession: (deps: Record<string, unknown>) => void
      getSnapshot: () => unknown
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
  await page.addInitScript(() => {
    // Force the file-input fallback so Playwright can setInputFiles / filechooser.
    Reflect.deleteProperty(window, 'showOpenFilePicker')
    Reflect.deleteProperty(window, 'showDirectoryPicker')
  })
  await page.goto(url)
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  const home = page.getByTestId('home-screen')
  if (await home.isVisible()) {
    await page.getByTestId('start-session').click()
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
