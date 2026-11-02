import type { Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { pointOf } from './fixtures/locatorBox'

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
const master = (page: Page, name: string) =>
  page
    .getByRole('radiogroup', { name: 'Master' })
    .getByRole('radio', { name, exact: true })

async function applyMaster(page: Page, spreadId: string, name: string) {
  await page.getByTestId(`spread-list-item-${spreadId}`).click()
  await expect(canvasSpread(page, spreadId)).toBeVisible()
  await master(page, name).check({ force: true })
  await expect(master(page, name)).toBeChecked()
}

const pressedFrames = (page: Page) =>
  page.locator('button.spread-frame[aria-pressed="true"]')

/** Kit #/demo spread 2–3 at 1440 × 900: section 170.59 px, three 86.66 × 24 px segments. */
async function expectKitMasterBoxes(page: Page) {
  const section = await page.getByTestId('spread-master-spacing').boundingBox()
  expect(Math.abs((section?.height ?? 0) - 170.59)).toBeLessThanOrEqual(0.5)
  const radios = page
    .getByRole('radiogroup', { name: 'Master' })
    .getByRole('radio')
  await expect(radios).toHaveCount(3)
  const boxes = await radios.evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  expect(
    boxes.every(
      (b) => Math.abs(b.width - 86.66) <= 0.5 && Math.round(b.height) === 24,
    ),
  ).toBe(true)
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
  await expect(master(page, 'None')).toBeChecked()
  await expect(page.getByRole('radiogroup', { name: 'Master' })).toHaveText(
    /^Master A\s*Master B\s*None$/,
  )
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
