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

    // Inspector is open by default (uikit/src/features/parts.tsx:26).
    await filledFrame(page).dblclick()
    await expect(filledFrame(page)).toHaveAttribute('data-crop-active', 'true')
    const center = await frameCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -1500)
    await expect(page.getByTestId('crop-reset')).toBeEnabled()
    await expect(badge).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })

  // Kit #/demo (Designer ruling 2026-10-31): low-res shows only as the ppi chip
  // in the Photo inspector header (filename / px / ppi), in the warn tone.
  test('low resolution shows as the warn-tone ppi chip in the Photo inspector', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openSessionEditor(page)
    await placeLargePhoto(page)
    // Inspector is open by default (uikit/src/features/parts.tsx:26).
    await expect(page.getByTestId('panel-r')).toHaveAttribute(
      'data-open',
      'true',
    )
    await filledFrame(page).click()
    const chip = page
      .getByTestId('inspector-photo')
      .getByTestId('inspector-photo-dpi')
    await expect(chip).toHaveAttribute('data-color', 'success')
    const sharp = Number.parseInt((await chip.textContent()) ?? '', 10)
    expect(sharp).toBeGreaterThanOrEqual(200)

    await filledFrame(page).dblclick()
    await expect(filledFrame(page)).toHaveAttribute('data-crop-active', 'true')
    const center = await frameCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -1500)
    await expect(chip).toHaveAttribute('data-color', /^(warning|error)$/)
    const soft = Number.parseInt((await chip.textContent()) ?? '', 10)
    expect(soft).toBeLessThan(200)
    await expect(chip).toHaveText(`${String(soft)} ppi`)
    const tone = await chip.getAttribute('data-color')
    const paint = await chip.evaluate((el, t) => {
      const s = getComputedStyle(el)
      const root = getComputedStyle(document.documentElement)
      const probe = document.createElement('span')
      probe.style.color = root.getPropertyValue(`--badge-${String(t)}-fg`)
      probe.style.backgroundColor = root.getPropertyValue(
        `--badge-${String(t)}-bg`,
      )
      document.body.append(probe)
      const p = getComputedStyle(probe)
      const want = { bg: p.backgroundColor, color: p.color }
      probe.remove()
      return { got: { bg: s.backgroundColor, color: s.color }, want }
    }, tone)
    expect(paint.want.color).not.toBe('')
    expect(paint.got).toEqual(paint.want)
    await expect(page.getByTestId('dpi-badge')).toHaveCount(0)
  })

  test('never paints in Preview', async ({ page }) => {
    test.setTimeout(180_000)
    await openSessionEditor(page)
    await placeLargePhoto(page)
    // Inspector is open by default (uikit/src/features/parts.tsx:26).
    await expect(page.getByTestId('panel-r')).toHaveAttribute(
      'data-open',
      'true',
    )
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
