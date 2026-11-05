import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { chooseZoom } from './fixtures/zoomMenu'

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('locator has no box')
  }
  return box
}

// parent-overrides-copy-reselect: `&parent=a` puts Master A (one logo in the
// top margin) on every painter spread.
const SPREAD = 'painter-spread-1'
const canvasSpread = (page: Page) =>
  page.locator(`[data-testid="spread-view"][data-spread-id="${SPREAD}"]`)
const parentLayer = (page: Page) =>
  canvasSpread(page).getByTestId('parent-layer')
const inheritedLogo = (page: Page) =>
  parentLayer(page).locator('[data-parent-item="true"]')
const copyOf = (page: Page) =>
  parentLayer(page).locator('button.spread-frame[data-override="true"]')

/** Ctrl+Shift press at (x, y), then an Alt (no snap) drag by `dx`. */
async function ctrlShiftPress(page: Page, x: number, y: number, dx = 0) {
  await page.mouse.move(x, y)
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  if (dx !== 0) {
    await page.keyboard.down('Alt')
    await page.mouse.move(x + dx, y, { steps: 6 })
    await page.keyboard.up('Alt')
  }
  await page.mouse.up()
}

/** The topmost `.spread-frame` at (x, y) (a copy's handles may sit above). */
function frameAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) =>
      document
        .elementsFromPoint(px, py)
        .find((el) => el.matches('.spread-frame'))
        ?.getAttribute('data-frame-id') ?? null,
    [x, y] as const,
  )
}

test('Ctrl+Shift reselects a copy covered by an own frame and moves it, with no undo step of its own', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  await page.getByTestId(`spread-list-item-${SPREAD}`).click()
  const logo = inheritedLogo(page)
  await expect(logo).toBeVisible()
  const logoBox = await boxOf(logo)

  // An own frame drawn from the logo's bottom-left up past the paper top
  // (clamped to it) covers the logo's centre.
  const paper = await boxOf(canvasSpread(page))
  await page.keyboard.press('f')
  await page.mouse.move(logoBox.x + 2, logoBox.y + logoBox.height - 1)
  await page.mouse.down()
  await page.mouse.move(logoBox.x + logoBox.width + 40, paper.y - 20, {
    steps: 6,
  })
  await page.mouse.up()
  const drawn = canvasSpread(page).locator(
    'button.spread-frame:not([data-override])[aria-pressed="true"]',
  )
  await expect(drawn).toHaveCount(1)
  const ownId = await drawn.getAttribute('data-frame-id')

  // Override the logo in place: the copy takes its slot under the own frame.
  await ctrlShiftPress(
    page,
    logoBox.x + logoBox.width / 2,
    logoBox.y + logoBox.height / 2,
  )
  const copy = copyOf(page)
  await expect(copy).toHaveCount(1)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  const undo = page.getByTestId('undo')
  const undoLabel = await undo.getAttribute('aria-label')
  expect(undoLabel).toContain('Override parent item')

  // Click away: the pasteboard gray left of the paper clears the selection.
  await page.mouse.click(paper.x - 30, paper.y + paper.height / 2)
  await expect(copy).not.toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('button.spread-frame[aria-pressed="true"]'),
  ).toHaveCount(0)

  // 200 %: the copy body is large enough to press clear of its handles.
  await chooseZoom(page, '200%')
  await copy.scrollIntoViewIfNeeded()
  const copyBox = await boxOf(copy)
  const x = copyBox.x + copyBox.width * 0.3
  const y = copyBox.y + copyBox.height / 2
  expect(await frameAt(page, x, y)).toBe(ownId)

  // Ctrl+Shift press on the covered copy: selected, no new copy, no undo step.
  await ctrlShiftPress(page, x, y)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('button.spread-frame[aria-pressed="true"]'),
  ).toHaveCount(1)
  await expect(copyOf(page)).toHaveCount(1)
  await expect(inheritedLogo(page)).toHaveCount(0)
  await expect(undo).toHaveAttribute('aria-label', undoLabel ?? '')
  // The press point is the copy body (no handle), still under the own frame.
  const handleAt = await page.evaluate(
    ([px, py]) =>
      document
        .elementsFromPoint(px, py)
        .some((el) => el.closest('[data-handle]') !== null),
    [x, y] as const,
  )
  expect(handleAt).toBe(false)

  // A drag past the 3 px slop moves the copy; the own frame stays on top.
  await ctrlShiftPress(page, x, y, 30)
  await expect
    .poll(async () => (await boxOf(copy)).x - copyBox.x)
    .toBeCloseTo(30, 0)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  expect(await frameAt(page, x, y)).toBe(ownId)

  // Undo: the move, then the override; the reselect left no step between.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await boxOf(copy)).x).toBeCloseTo(copyBox.x, 0)
  await expect(undo).toHaveAttribute('aria-label', undoLabel ?? '')
  await page.keyboard.press('Control+z')
  await expect(copyOf(page)).toHaveCount(0)
  await expect(inheritedLogo(page)).toHaveCount(1)
})
