import type { Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { pointOf } from './fixtures/locatorBox'
import {
  masterOptions,
  masterSelect,
  pickMaster,
  shownMaster,
} from './fixtures/spreadMaster'

// parent-spreads part 1: the painter fixture has parents "Master A" (one logo
// in the top margin) and "Master B" (empty), applied to no spread.
const canvasSpread = (page: Page, id: string) =>
  page.locator(`[data-testid="spread-view"][data-spread-id="${id}"]`)
const canvasLogo = (page: Page, id: string) =>
  canvasSpread(page, id).locator('[data-testid="parent-layer"] .spread-frame')
const listLogo = (page: Page, id: string) =>
  page
    .getByTestId(`spread-list-item-${id}`)
    .locator('.spread-view-parent-layer .spread-frame')
async function applyMaster(page: Page, spreadId: string, name: string) {
  await page.getByTestId(`spread-list-item-${spreadId}`).click()
  await expect(canvasSpread(page, spreadId)).toBeVisible()
  await pickMaster(page, name)
}

const pressedFrames = (page: Page) =>
  page.locator('button.spread-frame[aria-pressed="true"]')

/** default-master S1 / S2 at 1440 × 900: a full-width 268 px select, then the 16.8 px status line. */
async function expectKitMasterBoxes(page: Page) {
  const select = await masterSelect(page).boundingBox()
  expect(Math.abs((select?.width ?? 0) - 268)).toBeLessThanOrEqual(0.5)
  const status = await page.getByTestId('spread-master-status').boundingBox()
  expect(Math.abs((status?.height ?? 0) - 16.8)).toBeLessThanOrEqual(0.05)
  expect(
    Math.abs((status?.y ?? 0) - ((select?.y ?? 0) + (select?.height ?? 0) + 6)),
  ).toBeLessThanOrEqual(0.5)
}

/** The parent logo paints on the canvas spread (with its photo) and its list thumb. */
async function expectLogoOn(page: Page, spreadId: string) {
  await expect(canvasLogo(page, spreadId)).toHaveCount(1)
  await expect(canvasLogo(page, spreadId)).toBeVisible()
  await expect(canvasLogo(page, spreadId)).toHaveAttribute(
    'data-filled',
    'true',
  )
  await expect(listLogo(page, spreadId)).toHaveCount(1)
}

test('a parent applied to two spreads paints its item on both, inert; None removes it on one only', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  const [a, b] = ['painter-spread-1', 'painter-spread-2']

  // Empty: no spread uses a parent yet.
  await page.getByTestId(`spread-list-item-${a}`).click()
  await expect.poll(() => shownMaster(page)).toBe('None')
  expect(await masterOptions(page)).toEqual(['Master A', 'Master B', 'None'])
  await expect(canvasSpread(page, a).getByTestId('parent-layer')).toHaveCount(0)
  await expectKitMasterBoxes(page)

  // Happy: Master A on spreads a and b; the section keeps its kit box.
  await applyMaster(page, a, 'Master A')
  await applyMaster(page, b, 'Master A')
  await expectLogoOn(page, a)
  await expectLogoOn(page, b)
  await expectKitMasterBoxes(page)

  // Interact: with a spread frame selected, clicking the logo selects nothing.
  await page.getByTestId(`spread-list-item-${a}`).click()
  await canvasSpread(page, a).locator('button.spread-frame').first().click()
  await expect(pressedFrames(page)).toHaveCount(1)
  const { clientX, clientY } = await pointOf(canvasLogo(page, a))
  const hit = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return {
        inParentLayer: el?.closest('[data-testid="parent-layer"]') !== null,
        onFrame: el?.closest('.spread-frame') !== null,
      }
    },
    [clientX, clientY] as const,
  )
  // Nothing paints over the logo, and the click falls through its layer.
  expect(hit).toEqual({ inParentLayer: false, onFrame: false })
  await page.mouse.click(clientX, clientY)
  await expect(pressedFrames(page)).toHaveCount(0)
  await expect(page.getByTestId('spread-frame-handles')).toHaveCount(0)
  await expect(canvasLogo(page, a)).toBeVisible()

  // None on spread a: gone there, still on b.
  await applyMaster(page, a, 'None')
  await expect(canvasSpread(page, a).getByTestId('parent-layer')).toHaveCount(0)
  await expect(listLogo(page, a)).toHaveCount(0)
  await expect(canvasLogo(page, b)).toHaveCount(1)
  await expect(listLogo(page, b)).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})
