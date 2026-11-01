import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import jpeg from 'jpeg-js'
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
} from './perf/perfFixture'

const COUNT = 200
const HEIC_NAME = 'zz-phone.heic'

interface FolderEntry {
  name: string
  /** Index into `bodies` (one shared body per kind keeps the payload small). */
  body: number
}

/** 20-byte `ftyp heic` box: sniffs as HEIC, no decoder can open it. */
function minimalHeic(): Buffer {
  const bytes = Buffer.alloc(20)
  bytes.writeUInt32BE(20, 0)
  bytes.write('ftyp', 4)
  bytes.write('heic', 8)
  return bytes
}

/** Banded RGB JPEG (camera-like decode cost, still a compact file). */
function mediumJpeg(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = (x * 7) & 255
      data[i + 1] = (y * 5) & 255
      data[i + 2] = ((x + y) * 3) & 255
      data[i + 3] = 255
    }
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 80).data)
}

/**
 * Real OPFS directory as the photo folder (FSA root with durable identity,
 * so every thumb320 lands in DerivedCache under its identity key).
 */
async function pickOpfsPhotoFolder(
  page: Page,
  dirName: string,
  bodies: readonly Buffer[],
  entries: readonly FolderEntry[],
): Promise<void> {
  await page.evaluate(
    async ({ dirName, bodies, entries }) => {
      const decoded = bodies.map((base64) => {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }
        return bytes
      })
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle(dirName, { create: true })
      for (const entry of entries) {
        const handle = await dir.getFileHandle(entry.name, { create: true })
        const writable = await handle.createWritable()
        const body = decoded[entry.body]
        if (body === undefined) {
          throw new Error(`missing body ${String(entry.body)}`)
        }
        await writable.write(body)
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: () => Promise.resolve(dir),
      })
    },
    {
      dirName,
      bodies: bodies.map((body) => body.toString('base64')),
      entries,
    },
  )
  await page.getByTestId('film-add-folder').click()
}

/** thumb320 rows in the OPFS DerivedCache (`<identityHash>_thumb`). */
async function derivedThumbCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('photobooks-derived', {
      create: true,
    })
    let count = 0
    for await (const [name] of dir as unknown as AsyncIterable<
      [string, unknown]
    >) {
      if (name.endsWith('_thumb')) {
        count += 1
      }
    }
    return count
  })
}

async function mountedTiles(
  page: Page,
): Promise<{ name: string; placeholder: boolean }[]> {
  return page.getByTestId('filmstrip-item').evaluateAll((items) =>
    items.map((item) => ({
      name: item.querySelector('.filmstrip-drag')?.getAttribute('title') ?? '',
      placeholder:
        item.querySelector('[data-testid="filmstrip-placeholder"]') !== null,
    })),
  )
}

async function warmStats(
  page: Page,
): Promise<{ encoded: number; inFlight: number }> {
  return page.evaluate(() => {
    const api = window.__photobooksThumbs
    if (api === undefined) {
      throw new Error('__photobooksThumbs missing')
    }
    return api.getBackgroundWarmStatsForTests()
  })
}

async function importFolder(
  page: Page,
  dirName: string,
  bodies: readonly Buffer[],
  entries: readonly FolderEntry[],
): Promise<void> {
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await createBookViaLibrary(page, 'Background warm')
  await pickOpfsPhotoFolder(page, dirName, bodies, entries)
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(entries.length),
    { timeout: 120_000 },
  )
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('idle folder: every JPEG gets a stored thumb without scrolling; HEIC keeps its placeholder', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.goto('/?testLibrary=1')
  const entries: FolderEntry[] = Array.from({ length: COUNT }, (_, i) => ({
    name: `photo-${String(i).padStart(3, '0')}.jpg`,
    body: 0,
  }))
  entries.push({ name: HEIC_NAME, body: 1 })
  await importFolder(
    page,
    'warm-idle-photos',
    [readFileSync(photoFixturePaths.sampleOrient1Landscape), minimalHeic()],
    entries,
  )
  // Only the first filmstrip window is ever mounted (no scrolling).
  const mounted = await page.getByTestId('filmstrip-item').count()
  expect(mounted).toBeGreaterThan(0)
  expect(mounted).toBeLessThan(COUNT / 2)

  await expect
    .poll(async () => derivedThumbCount(page), { timeout: 120_000 })
    .toBe(COUNT)

  // HEIC: unsupported decode, no thumb row, placeholder tile at the tail.
  // Walk the strip end to end: every JPEG tile fills from DerivedCache; only
  // the HEIC stays gray.
  const scroll = page.getByTestId('filmstrip-scroll')
  const seen = new Map<string, boolean>()
  const { step, max } = await scroll.evaluate((node) => ({
    step: node.clientWidth / 2,
    max: node.scrollWidth - node.clientWidth,
  }))
  const stops = Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) =>
    Math.min(i * step, max),
  )
  for (const left of stops) {
    // Window commits on rAF: let it land before reading mounted tiles.
    await scroll.evaluate(async (node, next) => {
      node.scrollLeft = next
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
    }, left)
    await expect
      .poll(async () => {
        const tiles = await mountedTiles(page)
        for (const tile of tiles) {
          seen.set(tile.name, tile.placeholder)
        }
        return tiles.filter(
          (tile) => tile.placeholder !== (tile.name === HEIC_NAME),
        )
      })
      .toEqual([])
  }
  expect(seen.size).toBe(COUNT + 1)
  expect(seen.get(HEIC_NAME)).toBe(true)
  expect(await derivedThumbCount(page)).toBe(COUNT)
})

test.describe('frame-budget gates', () => {
  test('filmstrip scroll plus canvas pan while background thumbs encode: 0 LoAF', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.goto('/?testLibrary=1&perf=1')
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    const entries: FolderEntry[] = Array.from({ length: COUNT }, (_, i) => ({
      name: `shot-${String(i).padStart(3, '0')}.jpg`,
      body: 0,
    }))
    await importFolder(
      page,
      'warm-perf-photos',
      [mediumJpeg(3000, 2000)],
      entries,
    )
    await applyCpuThrottling(page)
    for (let i = 0; i < 3; i += 1) {
      await page.getByTestId('zoom-in').click()
    }
    const port = page.getByTestId('pasteboard-scroll')
    const box = await port.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    expect(box.width).toBeGreaterThan(0)
    const startScroll = await port.evaluate((el) => el.scrollLeft)

    // Background encode is running when the measured window opens.
    await expect
      .poll(async () => (await warmStats(page)).encoded, { timeout: 60_000 })
      .toBeGreaterThan(0)
    const before = (await warmStats(page)).encoded
    expect(before).toBeLessThan(COUNT / 2)
    await page.evaluate(browserBeginLoafScenarioWindow)

    const strip = page.getByTestId('filmstrip-scroll')
    for (let i = 0; i < 20; i += 1) {
      await strip.evaluate((node) => {
        node.scrollLeft += 160
      })
      await page.waitForTimeout(32)
    }
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.keyboard.down('Space')
    await page.mouse.down()
    for (let i = 1; i <= 10; i += 1) {
      await page.mouse.move(cx - i * 12, cy - i * 6, { steps: 2 })
    }
    await page.mouse.up()
    await page.keyboard.up('Space')
    for (let i = 0; i < 20; i += 1) {
      await strip.evaluate((node) => {
        node.scrollLeft -= 160
      })
      await page.waitForTimeout(32)
    }

    await page.evaluate(browserAssertNoLoaf, 0)
    expect(await port.evaluate((el) => el.scrollLeft)).not.toBe(startScroll)
    // The warm lane kept encoding during the window.
    const after = (await warmStats(page)).encoded
    expect(after).toBeGreaterThan(before)
    console.log(
      `warm encodes during window: ${String(before)} → ${String(after)}`,
    )
  })
})
