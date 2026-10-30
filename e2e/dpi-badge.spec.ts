import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { PERF_BUDGETS } from './perf/budgets'
import { applyCpuThrottling, clearPerfScenario } from './perf/perfFixture'

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

/** 6000×4000 photo in a full-bleed frame: sharp at cover, soft once zoomed. */
async function placeLargePhoto(page: Page): Promise<void> {
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.largeJpeg])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 60_000,
  })
  await applyLayout(page, 'Full bleed', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 60_000,
  })
}

function filledFrame(page: Page) {
  return page.locator('[data-testid="spread-frame"][data-filled="true"]')
}

async function frameCenter(page: Page) {
  const box = await filledFrame(page).boundingBox()
  if (box === null) {
    throw new Error('frame not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('low-resolution badge on frames', () => {
  test('stays off in the editor even when zoomed past the threshold (no bar control)', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openSessionEditor(page)
    await placeLargePhoto(page)
    const badge = page.getByTestId('dpi-badge')
    await expect(badge).toHaveCount(0)
    await expect(page.getByTestId('view-menu')).toHaveCount(0)

    await page.getByTestId('toggle-r').click()
    await filledFrame(page).dblclick()
    await expect(filledFrame(page)).toHaveAttribute('data-crop-active', 'true')
    const center = await frameCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -1500)
    await expect(page.getByTestId('crop-reset')).toBeEnabled()
    await expect(badge).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })

  test('never paints in Preview', async ({ page }) => {
    test.setTimeout(180_000)
    await openSessionEditor(page)
    await placeLargePhoto(page)
    await page.getByTestId('toggle-r').click()
    await filledFrame(page).dblclick()
    const center = await frameCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -1500)
    await expect(page.getByTestId('dpi-badge')).toHaveCount(0)
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('present')).toBeEnabled()
    await page.getByTestId('present').click()
    await expect(page.getByTestId('presentation')).toBeVisible()
    await expect(page.getByTestId('spread-frame-image').first()).toBeVisible()
    // The editor stays mounted under the stage; only the stage is Preview.
    const stage = page.getByTestId('presentation')
    await expect(stage.getByTestId('spread-frame-image').first()).toBeVisible()
    await expect(stage.getByTestId('dpi-badge')).toHaveCount(0)
  })

  test('crop-zoom pan across the threshold stays within frame-budget gates', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.goto('/?perf=1')
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await page.evaluate(() => {
      window.__photobooksProject?.startSessionEditor()
    })
    await page.getByTestId('editor-shell').waitFor({ state: 'visible' })
    await placeLargePhoto(page)
    await filledFrame(page).dblclick()
    const center = await frameCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.waitForTimeout(300)

    await applyCpuThrottling(page)
    await clearPerfScenario(page)
    // Alternate zoom in / out so the badge crosses the threshold repeatedly.
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, i % 2 === 0 ? -600 : 600)
      await page.waitForTimeout(250)
    }
    await page.mouse.down()
    const start = Date.now()
    let tick = 0
    while (Date.now() - start < 3_000) {
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
})
