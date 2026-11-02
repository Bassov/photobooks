import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import jpeg from 'jpeg-js'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { applyCpuThrottling } from './perf/perfFixture'

const COUNT = 1000
/** A stopped strip shows every thumb in its scrollport within this time. */
const SETTLE_MS = 5_000
/** Fractions of the scroll extent: back and forth, ending mid-strip. */
const FLING_LEGS = [1, 0.1, 0.9, 0.2, 0.7, 0.35, 0.55, 0.45] as const
const FLING_STEP_PX = 240

/** Banded RGB JPEG: camera-like decode cost, still a compact file. */
function bandedJpeg(width: number, height: number, seed: number): Buffer {
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = (x * 7 + seed * 40) & 255
      data[i + 1] = (y * 5) & 255
      data[i + 2] = ((x + y) * 3) & 255
      data[i + 3] = 255
    }
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 80).data)
}

/** `count` 3000×2000 JPEGs under distinct names (one tile each). */
function writeJpegFolder(count: number): string[] {
  const dir = join(
    tmpdir(),
    `photobooks-stuck-${String(process.pid)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const bodies = [0, 1].map((seed) => bandedJpeg(3000, 2000, seed))
  return Array.from({ length: count }, (_, i) => {
    const path = join(dir, `frame-${String(i).padStart(4, '0')}.jpg`)
    writeFileSync(path, bodies[i % bodies.length] ?? Buffer.alloc(0))
    return path
  })
}

/**
 * Fling the strip between `targets`, one `step` of scrollLeft per frame;
 * reverse inside the scroll-quiet window, like a hand on a wheel.
 */
async function fling(page: Page): Promise<void> {
  await page.getByTestId('filmstrip-scroll').evaluate(
    async (port, { targets, step }) => {
      const nextFrame = (): Promise<void> =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      for (const fraction of targets) {
        for (;;) {
          await nextFrame()
          const target = Math.round(
            fraction * (port.scrollWidth - port.clientWidth),
          )
          const left = port.scrollLeft
          if (Math.abs(left - target) <= 1) {
            break
          }
          port.scrollLeft =
            target > left
              ? Math.min(target, left + step)
              : Math.max(target, left - step)
        }
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    },
    { targets: FLING_LEGS, step: FLING_STEP_PX },
  )
}

/** Asset ids of scrollport tiles still on the placeholder. */
async function placeholdersInView(page: Page): Promise<string[]> {
  return page.getByTestId('filmstrip-scroll').evaluate((port) => {
    const view = port.getBoundingClientRect()
    const stuck: string[] = []
    for (const item of port.querySelectorAll(
      '[data-testid="filmstrip-item"]',
    )) {
      const box = item.getBoundingClientRect()
      const inView =
        box.right > view.left &&
        box.left < view.right &&
        box.bottom > view.top &&
        box.top < view.bottom
      if (
        inView &&
        item.querySelector('[data-testid="filmstrip-placeholder"]') !== null
      ) {
        stuck.push(item.getAttribute('data-asset-id') ?? '?')
      }
    }
    return stuck
  })
}

/** Scrollport placeholders left `SETTLE_MS` after the strip stops. */
async function stuckAfterStop(page: Page): Promise<string[]> {
  const deadline = Date.now() + SETTLE_MS
  let stuck = await placeholdersInView(page)
  while (stuck.length > 0 && Date.now() < deadline) {
    await page.waitForTimeout(100)
    stuck = await placeholdersInView(page)
  }
  return stuck
}

/**
 * Stop at every scrollport page from the start to the end (each tile is in
 * view at one stop at least); the first stop
 * with stuck tiles ends the walk.
 */
async function walkStuck(page: Page): Promise<string[]> {
  const scroll = page.getByTestId('filmstrip-scroll')
  await scroll.evaluate((node) => {
    node.scrollLeft = 0
  })
  for (let step = 0; step < 1000; step += 1) {
    const stuck = await stuckAfterStop(page)
    const remaining = await scroll.evaluate(
      (node) => node.scrollWidth - node.clientWidth - node.scrollLeft,
    )
    if (stuck.length > 0 || remaining <= 1) {
      return stuck
    }
    await scroll.evaluate(async (node) => {
      node.scrollLeft += node.clientWidth
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
    })
  }
  throw new Error('filmstrip walk did not reach the end')
}

/** Two flings, each followed by a stop; then a walk over the whole strip. */
async function flingAndCountStuck(page: Page): Promise<{
  firstStop: string[]
  secondStop: string[]
  walk: string[]
}> {
  await fling(page)
  const firstStop = await stuckAfterStop(page)
  await fling(page)
  const secondStop = await stuckAfterStop(page)
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(COUNT),
    { timeout: 120_000 },
  )
  const walk = await walkStuck(page)
  const stuck = { firstStop, secondStop, walk }
  console.log(
    `filmstrip-stuck-thumbs: ${String(firstStop.length)} / ${String(secondStop.length)} / ${String(walk.length)} stuck tiles (first stop / second stop / walk)`,
  )
  return stuck
}

const NONE_STUCK = { firstStop: [], secondStop: [], walk: [] }

let folder: string[] = []

test.beforeAll(() => {
  folder = writeJpegFolder(COUNT)
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  await applyCpuThrottling(page)
})

test('fling back and forth during import: every stopped tile gets its thumb', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await choosePhotoFolder(page, folder)
  await expect(page.getByTestId('import-progress')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByTestId('filmstrip-item').first()).toBeVisible({
    timeout: 60_000,
  })
  expect(await flingAndCountStuck(page)).toEqual(NONE_STUCK)
})

test('fling back and forth after import: every stopped tile gets its thumb', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await choosePhotoFolder(page, folder)
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(COUNT),
    { timeout: 120_000 },
  )
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 120_000,
  })
  expect(await flingAndCountStuck(page)).toEqual(NONE_STUCK)
})
