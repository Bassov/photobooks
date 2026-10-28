import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { PERF_BUDGETS } from './perf/budgets'
import { applyCpuThrottling, clearPerfScenario } from './perf/perfFixture'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

const spreadView = (page: Page) => page.getByTestId('spread-view').first()
const frames = (page: Page) => spreadView(page).getByTestId('spread-frame')

/** Delete every template frame so the spread is empty. */
async function clearSpread(page: Page): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    if ((await frames(page).count()) === 0) {
      return
    }
    await frames(page).first().click()
    await page.keyboard.press('Delete')
  }
  await expect(frames(page)).toHaveCount(0)
}

async function spreadBox(page: Page) {
  const box = await spreadView(page).boundingBox()
  if (box === null) {
    throw new Error('spread not visible')
  }
  return box
}

/** Client px per mm, probed with an Escape-cancelled draw. */
async function pxPerMm(page: Page): Promise<number> {
  const box = await spreadBox(page)
  await page.keyboard.press('f')
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 120, { steps: 3 })
  const size = await page
    .getByTestId('frame-draft')
    .getAttribute('data-size-mm')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByTestId('frame-draft')).toHaveCount(0)
  await page.keyboard.press('v')
  const widthMm = Number(size?.split('x')[0])
  return 100 / widthMm
}

/** Draw with the Frame tool; coordinates are fractions of the spread box. */
async function draw(
  page: Page,
  from: [number, number],
  to: [number, number],
  options: {
    /** Keys held during the drag (e.g. Alt). */
    keys?: string[]
    /** Runs while the pointer is still down. */
    midDrag?: () => Promise<void>
    /** Pixel offset added to the end point. */
    endPx?: [number, number]
  } = {},
): Promise<void> {
  const { keys = [], endPx = [0, 0] } = options
  const box = await spreadBox(page)
  await page.keyboard.press('f')
  await page.mouse.move(
    box.x + from[0] * box.width,
    box.y + from[1] * box.height,
  )
  await page.mouse.down()
  for (const key of keys) {
    await page.keyboard.down(key)
  }
  await page.mouse.move(
    box.x + to[0] * box.width + endPx[0],
    box.y + to[1] * box.height + endPx[1],
    { steps: 6 },
  )
  await options.midDrag?.()
  for (const key of keys) {
    await page.keyboard.up(key)
  }
  await page.mouse.up()
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('F → drag ≥ 5 mm draws a selected frame; Delete removes it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openSessionEditor(page)
  await clearSpread(page)

  await draw(page, [0.1, 0.1], [0.6, 0.5])
  await expect(frames(page)).toHaveCount(1)
  const frame = frames(page).first()
  await expect(frame).toHaveAttribute('data-filled', 'false')
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('spread-frame-handles')).toHaveCount(1)
  // Back on the Select tool.
  await expect(page.getByTestId('tool-select')).toBeChecked()
  // Empty frame reads as the dashed quiet-gray placeholder.
  const placeholder = frame.locator('.spread-frame-placeholder')
  expect(
    await placeholder.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe('dashed')
  await assertDocumentFitsViewport(page)

  await page.keyboard.press('Delete')
  await expect(frames(page)).toHaveCount(0)
  // Undo is one step and brings the frame back.
  await page.getByTestId('undo').click()
  await expect(frames(page)).toHaveCount(1)
})

test('a drag under 5 mm draws nothing', async ({ page }) => {
  test.setTimeout(90_000)
  await openSessionEditor(page)
  await clearSpread(page)
  const scale = await pxPerMm(page)
  const { width } = await spreadBox(page)
  const tiny = Math.floor(scale * 3) / width
  await draw(page, [0.2, 0.2], [0.2 + tiny, 0.6])
  await expect(frames(page)).toHaveCount(0)
  await expect(page.getByTestId('tool-frame')).toBeChecked()
})

test('a filmstrip photo drops into an empty drawn frame', async ({ page }) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await clearSpread(page)
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await draw(page, [0.1, 0.1], [0.7, 0.7])
  await expect(frames(page)).toHaveCount(1)
  const item = page.getByTestId('filmstrip-item').first()
  await expect
    .poll(async () => (await item.getAttribute('data-asset-id')) ?? '')
    .not.toBe('')
  const assetId = (await item.getAttribute('data-asset-id')) ?? ''
  await dropAssetOnFrame(page, assetId, frames(page).first())
  await expect(frames(page).first()).toHaveAttribute('data-filled', 'true', {
    timeout: 30_000,
  })
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
})

test('drawing near another frame shows a snap line; Alt suppresses it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openSessionEditor(page)
  await clearSpread(page)
  await draw(page, [0.6, 0.1], [0.9, 0.45])
  await expect(frames(page)).toHaveCount(1)
  await page.keyboard.press('Escape')

  // Each run starts on bare paper below the previous frame; its corner lands
  // 3 px left of the first frame's left edge.
  const snapLines = page.getByTestId('snap-line')
  await draw(page, [0.1, 0.55], [0.6, 0.67], {
    endPx: [-3, 0],
    midDrag: async () => {
      await expect(snapLines.first()).toContainText('snap · ')
    },
  })
  await expect(frames(page)).toHaveCount(2)
  await expect(snapLines).toHaveCount(0)

  await draw(page, [0.1, 0.85], [0.6, 0.97], {
    endPx: [-3, 0],
    keys: ['Alt'],
    midDrag: async () => {
      await expect(snapLines).toHaveCount(0)
    },
  })
  await expect(frames(page)).toHaveCount(3)
})

test('dragging a frame across a dense spread with snapping stays within frame-budget gates', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.goto('/?perf=1')
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await page.getByTestId('editor-shell').waitFor({ state: 'visible' })
  await clearSpread(page)
  const box = await spreadBox(page)
  // 5 × 4 grid of small frames, then one more to drag.
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 0.05 + col * 0.18
      const y = 0.05 + row * 0.2
      await draw(page, [x, y], [x + 0.13, y + 0.15], { keys: ['Alt'] })
    }
  }
  await expect(frames(page)).toHaveCount(20)
  await page.waitForTimeout(300)
  const { x: cx, y: cy } = await centerOf(frames(page).last())

  await applyCpuThrottling(page)
  await clearPerfScenario(page)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  const start = Date.now()
  let tick = 0
  while (Date.now() - start < 4_000) {
    tick += 1
    await page.mouse.move(
      Math.min(
        Math.max(cx + Math.sin(tick / 10) * box.width * 0.3, box.x + 20),
        box.x + box.width - 20,
      ),
      Math.min(
        Math.max(cy + Math.cos(tick / 10) * box.height * 0.3, box.y + 20),
        box.y + box.height - 20,
      ),
    )
    await page.waitForTimeout(8)
  }
  await page.mouse.up()

  await page.evaluate((handlerBudgetMs) => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.assertNoLoafEntries(0)
    perf.assertHandlerP95WithinBudget('frame-gesture', handlerBudgetMs)
  }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
})
