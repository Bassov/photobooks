import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// kit-undo-fixes (Designer notes on #491 parity): the kit `#/demo` editor
// undoes like prod. Undo of a spread op selects the spread that was current
// before it (redo the one after); Ctrl+Z / Shift+Ctrl+Z work while a Switch
// or another non-text control has focus, but not inside a text field.

const demo = (page: Page) => page.getByTestId('demo')
const rows = (page: Page) =>
  demo(page).locator('[data-testid="list"] [data-item^="p"]')
const row = (page: Page, i: number) =>
  demo(page).locator(`[data-testid="list"] [data-item="p${String(i)}"]`)
const current = (page: Page) =>
  demo(page).locator(
    '[data-testid="canvas"] [data-testid="spread"][data-current]',
  )
const inspector = (page: Page) => demo(page).getByTestId('ctx-inspector')
const textArea = (page: Page) =>
  inspector(page).getByRole('textbox', { name: 'Text' })
const align = (page: Page, name: string) =>
  inspector(page).getByRole('radio', { name })
// the selected spread row background (`.e7-item[aria-selected=true]`)
const SELECTED = [202, 202, 202]

async function openDemoBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(row(page, 4)).toBeVisible()
}

/** Keys go to the window, not to the control the test clicked last. */
async function blur(page: Page) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
}

async function spreadMenu(page: Page, i: number, item: string) {
  await goTo(page, i)
  await row(page, i).getByTestId('spread-menu').click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** A new book opens on spread 0; → steps the current spread (a list click does not set it in the kit demo). */
async function goTo(page: Page, i: number) {
  await expect(row(page, 0)).toHaveAttribute('aria-selected', 'true')
  await blur(page)
  for (let k = 1; k <= i; k++) {
    await page.keyboard.press('ArrowRight')
    await expect(row(page, k)).toHaveAttribute('aria-selected', 'true')
  }
}

/** RGB of the row background, inside its padding (top-left corner). */
async function rowPaint(page: Page, i: number) {
  const [px] = await pixelsAt(row(page, i), [{ x: 3, y: 3 }])
  return px?.slice(0, 3)
}

/** Spread 4 (sample t-hero4: five image frames) gets a text frame, aligned centre. */
async function drawAlignedText(page: Page) {
  await goTo(page, 4)
  await demo(page).locator('[aria-label="Text (T)"]').click()
  const b = await current(page).boundingBox()
  if (b === null) throw new Error('current spread has no box')
  const x = Math.round(b.x + b.width * 0.56)
  const y = Math.round(b.y + b.height * 0.62)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 200, y + 40, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.type('Morning')
  await page.keyboard.press('Escape')
  await expect(textArea(page)).toHaveValue('Morning')
  await align(page, 'Center').click()
  await expect(align(page, 'Center')).toBeChecked()
}

test.describe('kit undo fixes', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoBook(page)
  })

  test('undo of Duplicate spread selects the original, redo the copy', async ({
    page,
  }) => {
    const n = await rows(page).count()
    await spreadMenu(page, 3, 'Duplicate')
    await expect(rows(page)).toHaveCount(n + 1)
    await expect(row(page, 4)).toHaveAttribute('aria-selected', 'true')

    await blur(page)
    await page.keyboard.press('Control+z')
    await expect(rows(page)).toHaveCount(n)
    await expect(row(page, 3)).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 4)).toHaveAttribute('aria-selected', 'false')
    // paint: the original row is the highlighted one, its neighbour is not
    expect(await rowPaint(page, 3)).toEqual(SELECTED)
    expect(await rowPaint(page, 4)).not.toEqual(SELECTED)

    await page.keyboard.press('Shift+Control+z')
    await expect(rows(page)).toHaveCount(n + 1)
    await expect(row(page, 4)).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 3)).toHaveAttribute('aria-selected', 'false')
  })

  test('undo of Delete spread selects the deleted spread again', async ({
    page,
  }) => {
    const n = await rows(page).count()
    await spreadMenu(page, 3, 'Delete')
    await expect(rows(page)).toHaveCount(n - 1)
    await expect(row(page, 2)).toHaveAttribute('aria-selected', 'true')

    await blur(page)
    await page.keyboard.press('Control+z')
    await expect(rows(page)).toHaveCount(n)
    await expect(row(page, 3)).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Shift+Control+z')
    await expect(rows(page)).toHaveCount(n - 1)
    await expect(row(page, 2)).toHaveAttribute('aria-selected', 'true')
  })

  test('Ctrl+Z with a focused Switch undoes the last op', async ({ page }) => {
    await drawAlignedText(page)
    const live = inspector(page).getByRole('switch', {
      name: 'Live from photo metadata',
    })
    await live.focus()
    await expect(live).toBeFocused()

    await page.keyboard.press('Control+z')
    await expect(align(page, 'Left')).toBeChecked()
    await expect(live).not.toBeChecked()

    await live.focus()
    await page.keyboard.press('Shift+Control+z')
    await expect(align(page, 'Center')).toBeChecked()
  })

  test('Ctrl+Z inside the Text field leaves the doc history alone', async ({
    page,
  }) => {
    await drawAlignedText(page)
    await textArea(page).click()
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    await expect(textArea(page)).toHaveValue('Morning!')

    await page.keyboard.press('Control+z')
    await expect(textArea(page)).toBeFocused()
    await expect(align(page, 'Center')).toBeChecked()
    await expect(demo(page).getByTestId('redo')).toBeDisabled()
  })
})
