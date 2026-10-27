import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
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

async function placeOnePhoto(page: Page): Promise<void> {
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await page.getByRole('radio', { name: 'Full bleed' }).click()
  await dragPlaceFirstFilmstripItem(page, 0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
}

async function imageBox(page: Page) {
  return page.getByTestId('spread-frame-image').evaluate((el) => ({
    left: (el as HTMLElement).style.left,
    top: (el as HTMLElement).style.top,
    width: (el as HTMLElement).style.width,
  }))
}

async function frameCenter(page: Page) {
  const box = await page.getByTestId('spread-frame').boundingBox()
  if (box === null) {
    throw new Error('frame not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('no crop section until a photo is double-clicked; Esc leaves crop mode', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await expect(page.getByTestId('inspector-fit-crop')).toHaveCount(0)
  await placeOnePhoto(page)
  await page.getByTestId('spread-frame').dblclick()
  await expect(page.getByTestId('spread-frame')).toHaveAttribute(
    'data-crop-active',
    'true',
  )
  await expect(page.getByTestId('spread-frame-ghost')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('spread-frame')).not.toHaveAttribute(
    'data-crop-active',
    'true',
  )
  await expect(page.getByTestId('inspector-fit-crop')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('wheel zooms, arrows nudge, drag pans, Reset to cover restores', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await placeOnePhoto(page)
  const cover = await imageBox(page)
  await page.getByTestId('spread-frame').dblclick()
  // Right panel starts collapsed: open it through the top-bar toggle.
  await page.getByTestId('toggle-r').click()
  await expect(page.getByTestId('inspector-fit-crop')).toBeVisible()
  await expect(page.getByTestId('crop-reset')).toBeDisabled()

  const center = await frameCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -400)
  await expect
    .poll(async () => (await imageBox(page)).width)
    .not.toBe(cover.width)
  await expect(page.getByTestId('crop-reset')).toBeEnabled()

  const zoomed = await imageBox(page)
  await page.keyboard.press('Shift+ArrowLeft')
  await expect
    .poll(async () => (await imageBox(page)).left)
    .not.toBe(zoomed.left)

  const before = await imageBox(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 60, center.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await imageBox(page)).top).not.toBe(before.top)
  // The drag did not toggle the move-source selection.
  await expect(page.getByTestId('spread-frame')).not.toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByTestId('crop-reset').click()
  await expect.poll(async () => imageBox(page)).toEqual(cover)

  await page.getByTestId('undo').click()
  await expect
    .poll(async () => (await imageBox(page)).width)
    .not.toBe(cover.width)
  await assertDocumentFitsViewport(page)
})

test('reload keeps the crop', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Crop reload')
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await placeOnePhoto(page)

  await page.getByTestId('spread-frame').dblclick()
  const center = await frameCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -600)
  await expect.poll(async () => (await imageBox(page)).width).not.toBe('100%')
  await page.keyboard.press('Escape')
  const saved = await imageBox(page)

  await page.getByTestId('save-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect.poll(async () => imageBox(page)).toEqual(saved)
})

test('panning a crop for 5 s has zero LoAF and pointermove p95 within budget', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.goto('/?perf=1')
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await page.getByTestId('editor-shell').waitFor({ state: 'visible' })
  await placeOnePhoto(page)
  await page.getByTestId('spread-frame').dblclick()
  const center = await frameCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -900)
  await expect.poll(async () => (await imageBox(page)).width).not.toBe('100%')
  await page.waitForTimeout(300)

  await applyCpuThrottling(page)
  await clearPerfScenario(page)
  await page.mouse.down()
  const start = Date.now()
  let tick = 0
  while (Date.now() - start < 5_000) {
    tick += 1
    await page.mouse.move(
      center.x + Math.sin(tick / 8) * 60,
      center.y + Math.cos(tick / 8) * 40,
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
    perf.assertHandlerP95WithinBudget('crop-pan', handlerBudgetMs)
  }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
})
