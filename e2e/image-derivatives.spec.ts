import { basename } from 'node:path'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { PERF_BUDGETS } from './perf/budgets'
import {
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

/** Fixture library: every decodable sample, served same-origin. */
const LIBRARY = [
  photoFixturePaths.samplePng,
  photoFixturePaths.transparentCornersPng,
  photoFixturePaths.sampleOrient6,
  photoFixturePaths.sampleOrient6Landscape,
  photoFixturePaths.sampleOrient1Landscape,
  photoFixturePaths.sampleLossyWebp,
  photoFixturePaths.sampleLosslessWebp,
  photoFixturePaths.largeJpeg,
]
const FIXTURE_ROUTE = '/__derivative-fixtures/'

interface BrowserResult {
  assetHash: string
  presetId: string
  cacheHit: boolean
  ms: number
  decodeMs?: number
  outputHash?: string
  byteLength?: number
  width?: number
  height?: number
  error?: string
}

/** `window.__photobooksDerivatives` (src/derivatives/pool.ts, test builds). */
interface DerivativesSeam {
  requestDerivatives: (
    requests: { assetHash: string; readSource: () => Promise<Blob> }[],
  ) => Promise<BrowserResult[]>
  getDerivative: (
    assetHash: string,
    presetId: string,
  ) => Promise<{ bytes: ArrayBuffer; mimeType: string } | undefined>
  forgetDerivatives: (assetHash: string) => Promise<void>
}

declare global {
  interface Window {
    __photobooksDerivatives?: DerivativesSeam
  }
}

/** Background derivative run of the drag scenario, set when it settles. */
type DragWindow = Window & {
  __drv?: { done: number; results: BrowserResult[] }
}

async function frameCenter(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('frame not visible')
  }
  return { ...box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 }
}

async function serveLibrary(page: Page): Promise<void> {
  for (const path of LIBRARY) {
    await page.route(`**${FIXTURE_ROUTE}${basename(path)}`, (route) =>
      route.fulfill({ path }),
    )
  }
}

/** All presets for `names` (asset hash = file name), awaited in the page. */
function browserDerive(args: {
  route: string
  names: string[]
}): Promise<BrowserResult[]> {
  const api = window.__photobooksDerivatives
  if (api === undefined) {
    throw new Error('__photobooksDerivatives missing')
  }
  return api.requestDerivatives(
    args.names.map((name) => ({
      assetHash: name,
      readSource: async () => (await fetch(`${args.route}${name}`)).blob(),
    })),
  )
}

async function browserForget(names: string[]): Promise<void> {
  const api = window.__photobooksDerivatives
  if (api === undefined) {
    throw new Error('__photobooksDerivatives missing')
  }
  await Promise.all(names.map((name) => api.forgetDerivatives(name)))
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10
}

async function logBench(
  testInfo: TestInfo,
  name: string,
  value: unknown,
): Promise<void> {
  const body = JSON.stringify(value)
  console.log(`derivative-bench ${name}: ${body}`)
  await testInfo.attach(`derivative-bench-${name}`, {
    body,
    contentType: 'application/json',
  })
}

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test('fixture library derivatives are deterministic and served from the cache', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await serveLibrary(page)
  await page.goto('/')
  await page.waitForFunction(() => window.__photobooksDerivatives !== undefined)
  const names = LIBRARY.map((path) => basename(path))
  const args = { route: FIXTURE_ROUTE, names }
  await page.evaluate(browserForget, names)

  const first = await page.evaluate(browserDerive, args)
  await page.evaluate(browserForget, names)
  const second = await page.evaluate(browserDerive, args)
  const third = await page.evaluate(browserDerive, args)

  expect(first.filter((r) => r.error !== undefined)).toEqual([])
  expect(first).toHaveLength(names.length * 4)
  expect(first.every((r) => !r.cacheHit && r.outputHash !== undefined)).toBe(
    true,
  )
  // Same input → same output hash, twice.
  expect(second.map((r) => [r.assetHash, r.presetId, r.outputHash])).toEqual(
    first.map((r) => [r.assetHash, r.presetId, r.outputHash]),
  )
  expect(third.every((r) => r.cacheHit)).toBe(true)

  const size = (asset: string, preset: string) => {
    const hit = first.find(
      (r) => r.assetHash === asset && r.presetId === preset,
    )
    return [hit?.width, hit?.height]
  }
  expect(size('large-24mp.jpg', 'site-thumb')).toEqual([480, 320])
  expect(size('large-24mp.jpg', 'site-display')).toEqual([1600, 1067])
  expect(size('large-24mp.jpg', 'site-large')).toEqual([3200, 2133])
  // EXIF orientation 6 on raw 20×40 pixels: upright 40×20, never upscaled.
  expect(size('sample-orient6-landscape.jpg', 'site-large')).toEqual([40, 20])

  const entry = await page.evaluate(async () => {
    const api = window.__photobooksDerivatives
    const started = performance.now()
    const value = await api?.getDerivative('large-24mp.jpg', 'site-large')
    return {
      ms: performance.now() - started,
      mimeType: value?.mimeType,
      byteLength: value?.bytes.byteLength,
    }
  })
  expect(entry.mimeType).toBe('image/webp')

  const large = first.filter((r) => r.assetHash === 'large-24mp.jpg')
  await logBench(testInfo, 'unthrottled', {
    largeDecodeMs: round(large[0]?.decodeMs ?? 0),
    largePresetMs: Object.fromEntries(
      large.map((r) => [r.presetId, [round(r.ms), r.byteLength]]),
    ),
    smallPresetMsMax: round(
      Math.max(
        ...first
          .filter((r) => r.assetHash !== 'large-24mp.jpg')
          .map((r) => r.ms),
      ),
    ),
    cacheHasMsMax: round(Math.max(...third.map((r) => r.ms))),
    cacheGetLargeMs: round(entry.ms),
  })
})

test.describe('frame-budget gates', () => {
  test('dragging a frame while derivatives encode records zero LoAF', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    // Three distinct asset hashes, each a 24 MP JPEG.
    const names = ['drag-a.jpg', 'drag-b.jpg', 'drag-c.jpg']
    await page.route(`**${FIXTURE_ROUTE}drag-*.jpg`, (route) =>
      route.fulfill({ path: photoFixturePaths.largeJpeg }),
    )
    await enablePerfScenario(page)
    await page.evaluate(browserForget, names)

    const frame = page
      .getByTestId('spread-view')
      .first()
      .getByTestId('spread-frame')
      .first()
    await frame.click()
    const box = await frameCenter(frame)
    const { cx, cy } = box

    await page.evaluate(browserStartLoafScripts)
    await clearPerfScenario(page)
    await page.evaluate(
      ({ route, names: assets }) => {
        const state = window as DragWindow
        const api = window.__photobooksDerivatives
        if (api === undefined) {
          throw new Error('__photobooksDerivatives missing')
        }
        void api
          .requestDerivatives(
            assets.map((name) => ({
              assetHash: name,
              readSource: async () => (await fetch(`${route}${name}`)).blob(),
            })),
          )
          .then((results) => {
            state.__drv = { done: performance.now(), results }
          })
      },
      { route: FIXTURE_ROUTE, names },
    )
    const dragStart = await page.evaluate(() => performance.now())
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    const start = Date.now()
    let tick = 0
    while (Date.now() - start < 4_000) {
      tick += 1
      await page.mouse.move(
        cx + Math.sin(tick / 10) * box.width * 0.3,
        cy + Math.cos(tick / 10) * box.height * 0.3,
      )
      await page.waitForTimeout(8)
    }
    await page.mouse.up()
    const dragEnd = await page.evaluate(() => performance.now())
    // Attribution for any gated entry (script URL / function / invoker).
    await logBench(testInfo, 'drag-loaf-scripts', {
      rows: await page.evaluate(browserTakeLoafScripts),
    })

    await page.evaluate((handlerBudgetMs) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(0)
      perf.assertHandlerP95WithinBudget('frame-gesture', handlerBudgetMs)
    }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)

    await expect
      .poll(
        () => page.evaluate(() => (window as DragWindow).__drv !== undefined),
        {
          timeout: 120_000,
        },
      )
      .toBe(true)
    const { done, results } = await page.evaluate(() => {
      const drv = (window as DragWindow).__drv
      if (drv === undefined) {
        throw new Error('derivatives not settled')
      }
      return drv
    })
    expect(results.filter((r) => r.error !== undefined)).toEqual([])
    expect(results).toHaveLength(names.length * 4)
    // The encode overlapped the drag instead of finishing before it.
    expect(done).toBeGreaterThan(dragStart)
    await logBench(testInfo, 'drag-throttled', {
      dragMs: round(dragEnd - dragStart),
      encodeDoneAfterDragStartMs: round(done - dragStart),
      decodeMs: results
        .filter((r) => r.presetId === 'site-thumb')
        .map((r) => round(r.decodeMs ?? 0)),
      presetMs: results.map((r) => round(r.ms)),
    })
  })
})
