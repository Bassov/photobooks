import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { chooseZoom } from './fixtures/zoomMenu'

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('locator has no box')
  }
  return box
}

// parent-overrides-canvas: `&parent=a` puts Master A (one logo in the top
// margin, 24 × 8 mm) on all 40 painter spreads; nothing paints over it.
const canvasSpread = (page: Page, id: string) =>
  page.locator(`[data-testid="spread-view"][data-spread-id="${id}"]`)
const parentLayer = (page: Page, id: string) =>
  canvasSpread(page, id).getByTestId('parent-layer')
const inheritedLogo = (page: Page, id: string) =>
  parentLayer(page, id).locator('[data-parent-item="true"]')
const copyOf = (page: Page, id: string) =>
  parentLayer(page, id).locator('button.spread-frame[data-override="true"]')
const badge = (copy: Locator) => copy.getByTestId('override-badge')

async function openSpread(page: Page, id: string) {
  await page.getByTestId(`spread-list-item-${id}`).click()
  await expect(inheritedLogo(page, id)).toBeVisible()
}

/** Ctrl+Shift press at the box centre, then an Alt (no snap) drag by `dx`. */
async function overrideDrag(page: Page, target: Locator, dx: number) {
  const box = await boxOf(target)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
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

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=painter&parent=a')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
})

test('Ctrl+Shift through an own frame overrides the logo and moves the copy; undo twice restores it', async ({
  page,
}) => {
  const a = 'painter-spread-1'
  await openSpread(page, a)
  const logo = inheritedLogo(page, a)
  // Empty → marked: the inherited logo wears the dashed --parent-soft outline.
  const outline = await logo.evaluate((el) => {
    const after = getComputedStyle(el, '::after')
    return `${after.outlineStyle} ${after.outlineWidth} ${after.outlineColor}`
  })
  expect(outline).toBe('dashed 1px rgb(163, 161, 162)')
  await expect(copyOf(page, a)).toHaveCount(0)

  // A plain click on the uncovered logo selects nothing and announces the key.
  const logoBox = await boxOf(logo)
  await page.mouse.click(
    logoBox.x + logoBox.width / 2,
    logoBox.y + logoBox.height / 2,
  )
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Parent item from “Master A”. Ctrl+Shift+click to override it on this spread.',
  )
  await expect(
    page.locator('button.spread-frame[aria-pressed="true"]'),
  ).toHaveCount(0)

  // An own frame drawn from the logo's bottom-left up past the paper top
  // (clamped to it) covers the logo's centre.
  const paper = await boxOf(canvasSpread(page, a))
  await page.keyboard.press('f')
  await page.mouse.move(logoBox.x + 2, logoBox.y + logoBox.height - 1)
  await page.mouse.down()
  await page.mouse.move(logoBox.x + logoBox.width + 40, paper.y - 20, {
    steps: 6,
  })
  await page.mouse.up()
  const drawn = canvasSpread(page, a).locator(
    'button.spread-frame:not([data-override])[aria-pressed="true"]',
  )
  await expect(drawn).toHaveCount(1)
  const ownId = await drawn.getAttribute('data-frame-id')
  const own = canvasSpread(page, a).locator(
    `button.spread-frame[data-frame-id="${ownId ?? ''}"]`,
  )
  const ownBox = await boxOf(own)
  const coveredBy = await page.evaluate(
    ([x, y]) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.spread-frame')
        ?.getAttribute('data-frame-id'),
    [logoBox.x + logoBox.width / 2, logoBox.y + logoBox.height / 2] as const,
  )
  expect(coveredBy).toBe(ownId)

  // Interact: Ctrl+Shift press through the own frame, drag 30 px right.
  await overrideDrag(page, logo, 30)
  const copy = copyOf(page, a)
  await expect(copy).toHaveCount(1)
  await expect(inheritedLogo(page, a)).toHaveCount(0)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  await expect(copy).toHaveAttribute('data-filled', 'true')
  await expect
    .poll(async () => (await boxOf(copy)).x - logoBox.x)
    .toBeCloseTo(30, 0)
  expect(await boxOf(own)).toEqual(ownBox)
  // Still painted under the own frame: the own frame keeps the press point.
  const top = await page.evaluate(
    ([x, y]) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.spread-frame')
        ?.getAttribute('data-frame-id'),
    [
      logoBox.x + logoBox.width / 2 + 30,
      logoBox.y + logoBox.height / 2,
    ] as const,
  )
  expect(top).toBe(ownId)

  // Undo: the move, then the override.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await boxOf(copy)).x).toBeCloseTo(logoBox.x, 0)
  await page.keyboard.press('Control+z')
  await expect(copyOf(page, a)).toHaveCount(0)
  await expect(inheritedLogo(page, a)).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})

test('the override badge shows in full, icon-only, or not at all by the copy size', async ({
  page,
}) => {
  const b = 'painter-spread-2'
  await openSpread(page, b)
  await chooseZoom(page, '100%')
  await inheritedLogo(page, b).scrollIntoViewIfNeeded()
  await overrideDrag(page, inheritedLogo(page, b), 0)
  const copy = copyOf(page, b)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')

  // 100 %: 24 × 8 mm ≈ 91 × 30 px → the full badge (kit 66.42 × 16.84).
  const full = await boxOf(badge(copy))
  await expect(badge(copy)).toHaveAttribute('data-fit', 'full')
  await expect(badge(copy)).toHaveText('override')
  expect(Math.abs(full.height - 16.85)).toBeLessThanOrEqual(0.5)
  expect(full.width).toBeGreaterThan(55)
  expect(full.width).toBeLessThan(75)
  const copyBox = await boxOf(copy)
  expect(full.x - copyBox.x).toBeCloseTo(4, 0)
  expect(full.y - copyBox.y).toBeCloseTo(4, 0)

  // Narrowed to ~40 px with the east handle (snaps may shift it) → icon only.
  const east = await boxOf(copy.locator('[data-handle="e"]'))
  await page.mouse.move(east.x + east.width / 2, east.y + east.height / 2)
  await page.mouse.down()
  await page.mouse.move(copyBox.x + 40, east.y + east.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect
    .poll(async () => (await boxOf(copy)).width)
    .toBeLessThan(copyBox.width - 20)
  const narrow = await boxOf(copy)
  expect(narrow.width).toBeGreaterThanOrEqual(26)
  expect(narrow.width).toBeLessThan(50)
  await expect(badge(copy)).toHaveAttribute('data-fit', 'icon')
  await expect(badge(copy)).toHaveAttribute('aria-label', 'Override')
  const icon = await boxOf(badge(copy))
  expect(Math.abs(icon.width - 18)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(icon.height - 16.85)).toBeLessThanOrEqual(0.5)

  // 50 %: under 25 × 15 px → no badge.
  // `chooseZoom` matches "150%" too; pick the exact row.
  await page.getByTestId('zoom-menu').click()
  await page.getByRole('menuitem', { name: '50%', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect
    .poll(async () => (await boxOf(copy)).height)
    .toBeLessThan(full.height)
  await expect(badge(copy)).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})
