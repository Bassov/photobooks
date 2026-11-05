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
// Its photos have no `contentHash`, like a folder import: Export hashes them.
const FIXTURE = '/?fixture=painter'
const BOOK_ID = 'painter-fixture'
// Solid colours of the four placed photos (`src/testFixtures/painterSourceFile.ts`).
const PHOTO_RGB = [
  [0x6b, 0x8f, 0x71],
  [0xc4, 0xa5, 0x74],
  [0x8a, 0x9a, 0x84],
  [0xd0, 0x7a, 0x5a],
] as const

interface PillSample {
  state: string
  x: number
  y: number
  width: number
  height: number
  at: number
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

/** Centre pixel of every image in `dist/assets/` of an OPFS folder. */
async function readAssetColors(page: Page, name: string): Promise<number[][]> {
  return page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle(name)
    const dist = await folder.getDirectoryHandle('dist')
    const assets = await dist.getDirectoryHandle('assets')
    const out: number[][] = []
    for await (const entry of (
      assets as unknown as { values: () => AsyncIterable<FileSystemFileHandle> }
    ).values()) {
      const bitmap = await createImageBitmap(await entry.getFile())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      context?.drawImage(bitmap, 0, 0)
      const pixel = context?.getImageData(
        Math.floor(bitmap.width / 2),
        Math.floor(bitmap.height / 2),
        1,
        1,
      ).data
      out.push([pixel?.[0] ?? -1, pixel?.[1] ?? -1, pixel?.[2] ?? -1])
    }
    return out
  }, name)
}

/** Every placed photo has an encoded file in `dist/assets/`; returns the file count. */
async function expectEveryPhotoExported(
  page: Page,
  name: string,
): Promise<number> {
  const colors = await readAssetColors(page, name)
  for (const rgb of PHOTO_RGB) {
    const near = colors.some((color) =>
      color.every((channel, i) => Math.abs(channel - (rgb[i] ?? 0)) <= 12),
    )
    expect(near, `dist/assets has rgb(${rgb.join(', ')})`).toBe(true)
  }
  return colors.length
}

/** Resolve after two animation frames (the next paint has happened). */
async function nextPaint(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )
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
        at: Math.round(performance.now()),
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

/** Open Options with a folder (picked when asked). */
async function openOptions(page: Page, pick: boolean): Promise<void> {
  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  if (pick) {
    await page.getByTestId('export-site-choose').click()
  }
  await expect(page.getByTestId('export-site-folder')).toBeVisible()
}

/** Options → (pick when asked) → Export. */
async function startExport(page: Page, pick: boolean): Promise<void> {
  await openOptions(page, pick)
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

/** Press on the first canvas frame and start the drag with one move. */
async function grabFrame(page: Page): Promise<{ x: number; y: number }> {
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
  await page.mouse.move(x + 3, y + 2)
  return { x, y }
}

/** Drag the first canvas frame in `steps` moves (a few px each). */
async function dragFrame(page: Page, steps: number): Promise<void> {
  const { x, y } = await grabFrame(page)
  for (let step = 2; step <= steps; step += 1) {
    await page.mouse.move(x + step * 3, y + step * 2)
  }
  await page.mouse.up()
}

/** Grab a frame and keep moving it (button held) until the export ends. */
async function dragWhileRunning(page: Page): Promise<void> {
  const { x, y } = await grabFrame(page)
  for (let step = 1; step <= 200; step += 1) {
    await page.mouse.move(x + (step % 40) * 3, y + (step % 40) * 2)
    // One move per animation frame, like a pointer.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        }),
    )
    if (
      step % 10 === 0 &&
      (await pill(page).getAttribute('data-state')) !== 'running'
    ) {
      return
    }
  }
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

test('exports every placed photo while a frame is dragged, with a steady pill', async ({
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
  const assetFiles = await expectEveryPhotoExported(page, 'site')
  expect(await readSiteBookIds(page, 'site')).toEqual([BOOK_ID])
  const { samples, moves } = await page.evaluate(() => {
    const w = window as ExportWindow
    return { samples: w.__pillSamples ?? [], moves: w.__movesWhileRunning }
  })
  console.log(
    `static-export pill: ${JSON.stringify(samples)}, drag moves while running: ${String(moves)}, dist/assets files: ${String(assetFiles)}`,
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
    // The first gesture warms the frame-drag path (one LoAF with or without
    // an export running); the window then covers the whole export, from the
    // Export button on (opening the dialog is not part of the run).
    await dragFrame(page, 5)
    await openOptions(page, true)
    await expect(dialog(page)).toBeVisible()
    await nextPaint(page)
    await clearPerfScenario(page)
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(() => {
      ;(window as Window & { __longTasks?: number[] }).__longTasks = []
    })

    await page.getByTestId('export-site-go').click()
    await page.getByTestId('export-site-hide').click()
    await dragWhileRunning(page)
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
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    await collectFrameStatsArtifact(page, testInfo)
    await page.mouse.up()
    await expect(pill(page)).toHaveAttribute('data-state', 'done', {
      timeout: 60_000,
    })
    const samples = await page.evaluate(
      () => (window as ExportWindow).__pillSamples ?? [],
    )
    const assetFiles = await expectEveryPhotoExported(page, 'perf-site')
    console.log(
      `static-export run: ${JSON.stringify(samples)}, dist/assets files: ${String(assetFiles)}`,
    )

    expect(moves).toBeGreaterThan(0)
    expect(longest).toBeLessThanOrEqual(50)
  })
})
