import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { expandDisclosure } from './fixtures/expandDisclosure'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'
import {
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
})

async function selectFrame(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  const frame = page.getByTestId('spread-frame').nth(2)
  await frame.click()
  await expandDisclosure(page, 'Position & size')
  await expect(page.getByTestId('inspector-geometry')).toBeVisible()
  return frame
}

const number = (text: string) => Number.parseFloat(text.replace(',', '.'))

test.describe('inspector numeric properties', () => {
  test('typing X / W moves and sizes the frame precisely', async ({ page }) => {
    const frame = await selectFrame(page)
    const width = page.getByRole('textbox', { name: 'Width' })
    await width.fill('60')
    await width.press('Enter')
    await expect(width).toHaveValue(/^60(\.0)?$/)
    const x = page.getByRole('textbox', { name: 'X' })
    await x.fill('12.5')
    await x.press('Enter')
    await expect(x).toHaveValue('12.5')
    await expect(frame.getByTestId('frame-size-tag')).toContainText('60 ×')
  })

  test('values follow a resize drag live and settle on the committed numbers', async ({
    page,
  }) => {
    const frame = await selectFrame(page)
    const width = page.getByRole('textbox', { name: 'Width' })
    const before = number(await width.inputValue())
    const se = await frame.locator('[data-handle="se"]').boundingBox()
    const sx = (se?.x ?? 0) + (se?.width ?? 0) / 2
    const sy = (se?.y ?? 0) + (se?.height ?? 0) / 2
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx - 40, sy - 40, { steps: 4 })
    // Mid-drag: the inspector already shows the shrinking width.
    await expect
      .poll(async () => number(await width.inputValue()))
      .toBeLessThan(before)
    const tag = await frame.getByTestId('frame-size-tag').textContent()
    const liveWidth = number(await width.inputValue())
    expect(number(tag ?? '')).toBeCloseTo(liveWidth, 0)
    await page.mouse.up()
    await expect
      .poll(async () => number(await width.inputValue()))
      .toBeCloseTo(liveWidth, 0)
  })

  test('Esc mid-drag restores the inspector values', async ({ page }) => {
    const frame = await selectFrame(page)
    const width = page.getByRole('textbox', { name: 'Width' })
    const before = await width.inputValue()
    const se = await frame.locator('[data-handle="se"]').boundingBox()
    const sx = (se?.x ?? 0) + (se?.width ?? 0) / 2
    const sy = (se?.y ?? 0) + (se?.height ?? 0) / 2
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx - 40, sy - 40, { steps: 4 })
    await expect(width).not.toHaveValue(before)
    await page.keyboard.press('Escape')
    await expect(width).toHaveValue(before)
    await page.mouse.up()
  })
})

test.describe('inspector frame-budget gates', () => {
  test('resizing a frame with the inspector open stays within frame-budget gates', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page)
    const frame = await selectFrame(page)
    const width = page.getByRole('textbox', { name: 'Width' })
    const se = await frame.locator('[data-handle="se"]').boundingBox()
    const sx = (se?.x ?? 0) + (se?.width ?? 0) / 2
    const sy = (se?.y ?? 0) + (se?.height ?? 0) / 2

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    const before = await width.inputValue()
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    for (let tick = 1; tick <= 120; tick += 1) {
      await page.mouse.move(sx - 30 - Math.sin(tick / 8) * 25, sy - 20)
      await page.waitForTimeout(8)
    }
    // Live values were flowing while the pointer was down.
    await expect(width).not.toHaveValue(before)
    await page.mouse.up()

    await page.evaluate(browserAssertNoLoafThenClear)
  })
})
