import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { PERF_BUDGETS } from './perf/budgets'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

// Designer spec static-export Tests: the `?fixture=painter` editor exports
// into an OPFS folder that stands in for the `showDirectoryPicker` folder.
const FIXTURE = '/?fixture=painter&hashes=1'
const BOOK_ID = 'painter-fixture'

interface PillSample {
  state: string
  x: number
  y: number
  width: number
  height: number
}

type ExportWindow = Window & {
  __pillSamples?: PillSample[]
  __movesWhileRunning?: number
}

const pill = (page: Page) => page.getByTestId('export-site')
const dialog = (page: Page) => page.getByTestId('export-site-dialog')

/** `showDirectoryPicker` double → a fresh OPFS folder (`dist/notes.txt` when foreign). */
async function useOpfsFolder(
  page: Page,
  name: string,
  foreign = false,
): Promise<void> {
  await page.evaluate(
    async ({ name, foreign }) => {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(name, { recursive: true }).catch(() => undefined)
      const folder = await root.getDirectoryHandle(name, { create: true })
      if (foreign) {
        const dist = await folder.getDirectoryHandle('dist', { create: true })
        const file = await dist.getFileHandle('notes.txt', { create: true })
        const writable = await file.createWritable()
        await writable.write('mine')
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(folder),
      })
    },
    { name, foreign },
  )
}

/** `dist/` of an OPFS folder: path → SHA-256 hex of the bytes. */
async function readDist(
  page: Page,
  name: string,
): Promise<Record<string, string>> {
  return page.evaluate(async (name) => {
    const out: Record<string, string> = {}
    const hex = (buffer: ArrayBuffer) =>
      [...new Uint8Array(buffer)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const entry of (
        dir as unknown as {
          values: () => AsyncIterable<
            FileSystemDirectoryHandle | FileSystemFileHandle
          >
        }
      ).values()) {
        if (entry.kind === 'directory') {
          await walk(entry, `${prefix}${entry.name}/`)
        } else {
          const bytes = await (await entry.getFile()).arrayBuffer()
          out[`${prefix}${entry.name}`] = hex(
            await crypto.subtle.digest('SHA-256', bytes),
          )
        }
      }
    }
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle(name)
    await walk(await folder.getDirectoryHandle('dist'), '')
    return out
  }, name)
}

async function readSiteBookIds(page: Page, name: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle(name)
    const dist = await folder.getDirectoryHandle('dist')
    const file = await (await dist.getFileHandle('site.json')).getFile()
    const site = JSON.parse(await file.text()) as { books: { id: string }[] }
    return site.books.map((book) => book.id)
  }, name)
}

/** Record the pill rect on every `data-state` change, and drags while running. */
async function recordPill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as ExportWindow
    const node = document.querySelector('[data-testid="export-site"]')
    if (!(node instanceof HTMLElement)) {
      throw new Error('export-site pill missing')
    }
    const sample = () => {
      const rect = node.getBoundingClientRect()
      w.__pillSamples?.push({
        state: node.dataset.state ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }
    w.__pillSamples = []
    w.__movesWhileRunning = 0
    sample()
    new MutationObserver(sample).observe(node, {
      attributes: true,
      attributeFilter: ['data-state'],
    })
    window.addEventListener('pointermove', (event) => {
      if (event.buttons === 1 && node.dataset.state === 'running') {
        w.__movesWhileRunning = (w.__movesWhileRunning ?? 0) + 1
      }
    })
  })
}

/** Options → (pick when asked) → Export. */
async function startExport(page: Page, pick: boolean): Promise<void> {
  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  if (pick) {
    await page.getByTestId('export-site-choose').click()
  }
  await expect(page.getByTestId('export-site-folder')).toBeVisible()
  await page.getByTestId('export-site-go').click()
}

/** Export and stay in the dialog until it shows Done, then close it. */
async function exportToDone(page: Page, pick: boolean): Promise<void> {
  await startExport(page, pick)
  await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
    timeout: 30_000,
  })
  await page.getByTestId('export-site-close').click()
  await expect(dialog(page)).toHaveCount(0)
}

/** Drag the first canvas frame in `steps` moves (a few px each). */
async function dragFrame(page: Page, steps: number): Promise<void> {
  const frame = page
    .getByTestId('pasteboard-scroll')
    .getByTestId('spread-frame')
    .first()
  const box = await frame.boundingBox()
  if (box === null) {
    throw new Error('frame has no box')
  }
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x + step * 3, y + step * 2)
  }
  await page.mouse.up()
}

async function openFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
}

test('without a folder Export stays disabled', async ({ page }) => {
  await openFixture(page)

  await pill(page).click()

  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  await expect(page.getByTestId('export-site-choose')).toBeVisible()
  await expect(page.getByTestId('export-site-go')).toBeDisabled()
  await expect(page.getByTestId('export-site-books')).toContainText(
    'as it is now.',
  )
})

test('exports while a frame is dragged, with a pill that keeps its rect', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openFixture(page)
  await useOpfsFolder(page, 'site')
  await recordPill(page)
  // Slower CPU so Hide and the drag land while the export runs.
  await applyCpuThrottling(page)

  await startExport(page, true)
  await page.getByTestId('export-site-hide').click()
  await expect(dialog(page)).toHaveCount(0)
  await dragFrame(page, 12)
  await expect(pill(page)).toHaveAttribute('data-state', 'done', {
    timeout: 30_000,
  })
  await expect(pill(page)).toContainText('Exported')
  await expect(pill(page)).toHaveAttribute('data-state', 'idle', {
    timeout: 10_000,
  })

  const dist = await readDist(page, 'site')
  expect(Object.keys(dist)).toContain('index.html')
  expect(Object.keys(dist).some((path) => path.startsWith('assets/'))).toBe(
    true,
  )
  expect(await readSiteBookIds(page, 'site')).toEqual([BOOK_ID])
  const { samples, moves } = await page.evaluate(() => {
    const w = window as ExportWindow
    return { samples: w.__pillSamples ?? [], moves: w.__movesWhileRunning }
  })
  console.log(
    `static-export pill: ${JSON.stringify(samples)}, drag moves while running: ${String(moves)}`,
  )
  expect(moves).toBeGreaterThan(0)
  expect(new Set(samples.map((s) => s.state))).toEqual(
    new Set(['idle', 'running', 'done']),
  )
  const [first] = samples
  for (const sample of samples) {
    expect(Math.abs(sample.x - (first?.x ?? 0))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(sample.width - (first?.width ?? 0))).toBeLessThanOrEqual(
      0.5,
    )
    expect(Math.abs(sample.y - (first?.y ?? 0))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(sample.height - (first?.height ?? 0))).toBeLessThanOrEqual(
      0.5,
    )
  }
  const scroll = await page.evaluate(() => ({
    h: document.documentElement.scrollWidth > window.innerWidth,
    v: document.documentElement.scrollHeight > window.innerHeight,
  }))
  expect(scroll).toEqual({ h: false, v: false })
})

test('a second export of the same book is byte-identical', async ({ page }) => {
  test.setTimeout(90_000)
  await openFixture(page)
  await useOpfsFolder(page, 'twice')

  await exportToDone(page, true)
  const first = await readDist(page, 'twice')
  await expect(pill(page)).toHaveAttribute('data-state', 'idle', {
    timeout: 10_000,
  })
  // The folder is remembered: no picker the second time.
  await exportToDone(page, false)
  const second = await readDist(page, 'twice')

  expect(Object.keys(first).length).toBeGreaterThan(2)
  expect(second).toEqual(first)
})

test('only published books are exported, drafts stay out', async ({ page }) => {
  test.setTimeout(90_000)
  await openFixture(page)
  const draftId = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('project test api missing')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error('attach failed')
    }
    const copy = await (
      api as unknown as {
        duplicateBookInLibrary: (
          id: string,
        ) => Promise<{ ok: boolean; value?: { id: string } }>
      }
    ).duplicateBookInLibrary('painter-fixture')
    if (!copy.ok || copy.value === undefined) {
      throw new Error('duplicate failed')
    }
    return copy.value.id
  })
  await useOpfsFolder(page, 'library-site')

  await exportToDone(page, true)

  const ids = await readSiteBookIds(page, 'library-site')
  expect(ids).toEqual([BOOK_ID])
  expect(ids).not.toContain(draftId)
})

test('a foreign dist is left alone and explained', async ({ page }) => {
  await openFixture(page)
  await useOpfsFolder(page, 'home', true)

  await startExport(page, true)

  await expect(dialog(page)).toHaveAttribute('data-step', 'failed', {
    timeout: 30_000,
  })
  await expect(page.getByTestId('export-site-error')).toHaveText(
    'dist in “home” isn’t a Photobooks export, so it was left as it is. Choose another folder.',
  )
  expect(Object.keys(await readDist(page, 'home'))).toEqual(['notes.txt'])
  await page.getByTestId('export-site-rechoose').click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  await expect(page.getByTestId('export-site-choose')).toBeVisible()
})

test.describe('frame-budget gates', () => {
  test('dragging a frame while the site exports stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, `${FIXTURE}&perf=1`)
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await useOpfsFolder(page, 'perf-site')
    await recordPill(page)
    await page.evaluate(() => {
      const w = window as Window & { __longTasks?: number[] }
      w.__longTasks = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__longTasks?.push(entry.duration)
        }
      }).observe({ type: 'longtask' })
    })
    await clearPerfScenario(page)

    await startExport(page, true)
    await page.getByTestId('export-site-hide').click()
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(() => {
      ;(window as Window & { __longTasks?: number[] }).__longTasks = []
    })
    await dragFrame(page, 20)
    await expect(pill(page)).toHaveAttribute('data-state', 'done', {
      timeout: 60_000,
    })

    const rows = await page.evaluate(browserTakeLoafScripts)
    const { longTasks, moves } = await page.evaluate(() => {
      const w = window as Window & {
        __longTasks?: number[]
        __movesWhileRunning?: number
      }
      return { longTasks: w.__longTasks ?? [], moves: w.__movesWhileRunning }
    })
    const longest = Math.max(0, ...longTasks)
    console.log(
      `static-export perf: ${String(rows.length)} LoAF, ${String(longTasks.length)} long tasks, longest ${String(longest)} ms, drag moves while running ${String(moves)} ${JSON.stringify(rows)}`,
    )
    expect(moves).toBeGreaterThan(0)
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    expect(longest).toBeLessThanOrEqual(50)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
