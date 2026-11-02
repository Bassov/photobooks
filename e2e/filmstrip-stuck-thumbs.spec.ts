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
const FLING_LEGS = [0.6, 0.1, 0.55, 0.2, 0.5, 0.3, 0.45, 0.4] as const
const FLING_STEP_PX = 240
/** A leg that has not reached its target after this many frames fails. */
const FLING_LEG_MAX_FRAMES = 1_500

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
    async (port, { targets, step, maxFrames }) => {
      const nextFrame = (): Promise<void> =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      for (const fraction of targets) {
        for (let frame = 0; ; frame += 1) {
          await nextFrame()
          const target = Math.round(
            fraction * (port.scrollWidth - port.clientWidth),
          )
          const left = port.scrollLeft
          if (Math.abs(left - target) <= 1) {
            break
          }
          if (frame >= maxFrames) {
            throw new Error(
              `fling leg ${String(fraction)} stuck at ${String(left)} of ${String(target)}`,
            )
          }
          port.scrollLeft =
            target > left
              ? Math.min(target, left + step)
              : Math.max(target, left - step)
        }
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    },
    {
      targets: FLING_LEGS,
      step: FLING_STEP_PX,
      maxFrames: FLING_LEG_MAX_FRAMES,
    },
  )
}

/**
 * Scrollport placeholders left `SETTLE_MS` after the strip stops. With
 * `walk`, stop at every scrollport page from the start to the end (each tile
 * is in view at one stop at least); the first stop with stuck tiles ends the
 * walk. One in-page loop: no round trip per poll.
 */
async function stuckAfterStop(page: Page, walk = false): Promise<string[]> {
  return page.getByTestId('filmstrip-scroll').evaluate(
    async (port, { settleMs, walkAll }) => {
      const sleep = (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, ms))
      const placeholdersInView = (): string[] => {
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
      }
      const settle = async (): Promise<string[]> => {
        const deadline = performance.now() + settleMs
        let stuck = placeholdersInView()
        while (stuck.length > 0 && performance.now() < deadline) {
          await sleep(100)
          stuck = placeholdersInView()
        }
        return stuck
      }
      if (!walkAll) {
        return settle()
      }
      port.scrollLeft = 0
      for (let stop = 0; stop < 1000; stop += 1) {
        for (let frame = 0; frame < 3; frame += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve))
        }
        const stuck = await settle()
        const remaining = port.scrollWidth - port.clientWidth - port.scrollLeft
        if (stuck.length > 0 || remaining <= 1) {
          return stuck
        }
        port.scrollLeft += port.clientWidth
      }
      throw new Error('filmstrip walk did not reach the end')
    },
    { settleMs: SETTLE_MS, walkAll: walk },
  )
}

/** Two flings, each followed by a stop; then a walk over the whole strip. */
async function flingAndCountStuck(page: Page): Promise<{
  firstStop: string[]
  secondStop: string[]
  walk: string[]
}> {
  const t0 = Date.now()
  await fling(page)
  const firstStop = await stuckAfterStop(page)
  const t1 = Date.now()
  await fling(page)
  const secondStop = await stuckAfterStop(page)
  const t2 = Date.now()
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(COUNT),
    { timeout: 120_000 },
  )
  const t3 = Date.now()
  const walk = await stuckAfterStop(page, true)
  const t4 = Date.now()
  const stuck = { firstStop, secondStop, walk }
  console.log(
    `filmstrip-stuck-thumbs: ${String(firstStop.length)} / ${String(secondStop.length)} / ${String(walk.length)} stuck tiles (first stop / second stop / walk); ms ${String(t1 - t0)} / ${String(t2 - t1)} / ${String(t3 - t2)} / ${String(t4 - t3)}`,
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
