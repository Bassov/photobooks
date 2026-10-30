import type { Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
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
import { pointOf } from './fixtures/locatorBox'
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
  await applyLayout(page, 'Full bleed', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
}

async function selectFrame(page: Page): Promise<void> {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await filledFrame(page).click()
  await expect(page.getByTestId('inspector-rotate')).toBeVisible()
}

function filledFrame(page: Page) {
  return page.locator('[data-testid="spread-frame"][data-filled="true"]')
}

/** True when the four frame corners lie inside the (rotated) photo box. */
async function frameIsCovered(page: Page): Promise<boolean> {
  return page.getByTestId('spread-frame-image').evaluate((node) => {
    const img = node as HTMLImageElement
    const frame = img.closest<HTMLElement>('.spread-frame-body')
    if (frame === null) {
      return false
    }
    const style = getComputedStyle(img)
    const matrix = new DOMMatrix(style.transform).inverse()
    // Style values keep the sub-pixel box that offsetWidth rounds away.
    const w = parseFloat(img.style.width)
    const h = parseFloat(img.style.height)
    const left = parseFloat(img.style.left)
    const top = parseFloat(img.style.top)
    const ox = left + w / 2
    const oy = top + h / 2
    return [
      [0, 0],
      [frame.offsetWidth, 0],
      [frame.offsetWidth, frame.offsetHeight],
      [0, frame.offsetHeight],
    ].every(([x = 0, y = 0]) => {
      const p = matrix.transformPoint(new DOMPoint(x - ox, y - oy))
      const lx = ox + p.x - left
      const ly = oy + p.y - top
      return lx >= -0.5 && lx <= w + 0.5 && ly >= -0.5 && ly <= h + 0.5
    })
  })
}

const imageTransform = (page: Page) =>
  page
    .getByTestId('spread-frame-image')
    .evaluate((el) => (el as HTMLElement).style.transform)

test('rotate 90° from the inspector and the . , keys; undo restores', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await placeOnePhoto(page)
  await expect(page.getByTestId('inspector-rotate')).toHaveCount(0)
  expect(await imageTransform(page)).toBe('')
  await selectFrame(page)

  await page.getByTestId('rot-right').click()
  await expect.poll(() => imageTransform(page)).toContain('rotate(90deg)')
  await expect(page.getByTestId('rotate-summary')).toContainText('90°')
  expect(await frameIsCovered(page)).toBe(true)

  await page.getByTestId('rot-left').click()
  await expect.poll(() => imageTransform(page)).toBe('')

  await page.keyboard.press('.')
  await expect.poll(() => imageTransform(page)).toContain('rotate(90deg)')
  await page.keyboard.press(',')
  await page.keyboard.press(',')
  await expect.poll(() => imageTransform(page)).toContain('rotate(270deg)')
  expect(await frameIsCovered(page)).toBe(true)

  await page.keyboard.press('Control+z')
  await expect.poll(() => imageTransform(page)).toBe('')
  await assertDocumentFitsViewport(page)
})

test('straighten keeps the frame covered and resets on double-click', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await placeOnePhoto(page)
  await selectFrame(page)

  const slider = page.getByTestId('photo-straighten').getByRole('slider')
  await slider.focus()
  for (let step = 0; step < 24; step += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await expect(slider).toHaveValue('12')
  await expect.poll(() => imageTransform(page)).toContain('rotate(12deg)')
  expect(await frameIsCovered(page)).toBe(true)

  await page.keyboard.press('Home')
  await expect.poll(() => imageTransform(page)).toContain('rotate(-45deg)')
  expect(await frameIsCovered(page)).toBe(true)

  await page.getByTestId('rot-right').click()
  await expect.poll(() => imageTransform(page)).toContain('rotate(45deg)')
  expect(await frameIsCovered(page)).toBe(true)

  await page
    .getByTestId('photo-straighten')
    .locator('.fit-crop-track')
    .dblclick()
  await expect(slider).toHaveValue('0')
  await expect.poll(() => imageTransform(page)).toContain('rotate(90deg)')
  await assertDocumentFitsViewport(page)
})

test('reload keeps the quarter turn and the straighten angle', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Rotate reload')
  })
  await createBookViaLibrary(page)
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await placeOnePhoto(page)
  await selectFrame(page)
  await page.getByTestId('rot-right').click()
  const slider = page.getByTestId('photo-straighten').getByRole('slider')
  await slider.focus()
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await expect(slider).toHaveValue('3')
  await expect.poll(() => imageTransform(page)).toContain('rotate(93deg)')

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(filledFrame(page)).toHaveCount(1, { timeout: 30_000 })
  await page.getByTestId('relink-skip').click()
  await expect(page.getByTestId('relink-dialog')).toHaveCount(0)
  await selectFrame(page)
  await expect(page.getByTestId('rotate-summary')).toContainText('90°')
  await expect(
    page.getByTestId('photo-straighten').getByRole('slider'),
  ).toHaveValue('3')
})

test('straightening for 5 s stays within frame-budget gates', async ({
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
  await selectFrame(page)
  const track = page.getByTestId('photo-straighten').locator('.fit-crop-track')
  await track.scrollIntoViewIfNeeded()
  const { clientX: mid, clientY: y } = await pointOf(track)
  const halfWidth = (await track.evaluate((el) => el.clientWidth)) / 2
  await page.mouse.move(mid, y)
  await page.waitForTimeout(300)

  await applyCpuThrottling(page)
  await clearPerfScenario(page)
  await page.mouse.down()
  const start = Date.now()
  let tick = 0
  while (Date.now() - start < 5_000) {
    tick += 1
    await page.mouse.move(mid + Math.sin(tick / 8) * (halfWidth - 4), y)
    await page.waitForTimeout(8)
  }
  await page.mouse.up()

  await page.evaluate((handlerBudgetMs) => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.assertNoLoafEntries(0)
    perf.assertHandlerP95WithinBudget('straighten', handlerBudgetMs)
  }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
  expect(await frameIsCovered(page)).toBe(true)
})
