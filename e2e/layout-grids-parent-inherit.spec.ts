import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'

// layout-grids-parent-inherit (Designer Spec GP1–GP6): `&parent=a` makes
// Master A the book default, so all 40 painter spreads use it. The fixture
// book grid is 2 × 2, gutter 5 mm, equal 15 mm margins.
const OWN = 'painter-spread-5'
const GREY = 'rgb(83, 81, 82)'
const DARK = 'rgb(57, 55, 56)'

test.use({ viewport: { width: 1440, height: 900 } })

const input = (page: Page, field: string) =>
  page.getByTestId(`spread-grid-field-${field}`)
const fieldBox = (page: Page, field: string) => input(page, field).locator('..')

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (rect === null) {
    throw new Error('not visible')
  }
  return rect
}

async function commit(locator: Locator, value: string) {
  await locator.fill(value)
  await locator.press('Enter')
  await expect(locator).toHaveValue(value)
}

async function selectSpread(page: Page, spreadId: string) {
  await page.getByTestId(`spread-list-item-${spreadId}`).click()
  await expect(page.getByTestId('grid-section-spread')).toBeVisible()
}

async function openCustom(page: Page) {
  const section = page.getByTestId('grid-section-spread')
  await section.getByText('Custom', { exact: true }).click()
  await expect(section.getByRole('radio', { name: 'Custom' })).toBeChecked()
}

/** Zoom out until all 40 pasteboard spreads mount, and let the gesture settle. */
async function mountAllSpreads(page: Page) {
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await dispatchCtrlWheel(page, 500, 24)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()
}

/** Grid overlay columns per page of every mounted pasteboard spread, by id. */
async function columnsPerPage(page: Page): Promise<Record<string, number[]>> {
  return page
    .getByTestId('pasteboard-scroll')
    .locator('[data-testid="spread-view"]')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [
          node.getAttribute('data-spread-id') ?? '',
          [...node.querySelectorAll('[data-testid="grid-overlay-page"]')].map(
            (g) =>
              g.querySelectorAll('[data-testid="grid-overlay-column"]').length,
          ),
        ]),
      ),
    )
}

/** Spread ids whose every page shows `columns` overlay columns. */
async function spreadsAt(page: Page, columns: number): Promise<string[]> {
  return Object.entries(await columnsPerPage(page))
    .filter(
      ([, pages]) => pages.length > 0 && pages.every((n) => n === columns),
    )
    .map(([id]) => id)
}

async function setMasterColumns(page: Page, value: string) {
  await page.getByTestId('left-tab-masters').click()
  await commit(page.getByTestId('master-field-columns'), value)
  await page.getByTestId('left-tab-pages').click()
}

test('Browser check: inheritors follow Master A; a gutter override survives 3 → 4 columns; ↺ restores it', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await mountAllSpreads(page)
  await page.getByTestId('grid-topbar-toggle').click()

  await setMasterColumns(page, '3')
  await expect.poll(async () => (await spreadsAt(page, 3)).length).toBe(40)

  await selectSpread(page, OWN)
  const section = page.getByTestId('grid-section-spread')
  await expect(section.getByRole('radio', { name: 'Use master' })).toBeChecked()
  await expect(section.getByTestId('spread-grid-inherit')).toContainText(
    'Master A · 3 × 2 · gutter 5 mm',
  )
  await openCustom(page)
  await expect(fieldBox(page, 'columns')).toHaveAttribute(
    'data-source',
    'master',
  )
  await commit(input(page, 'columnGutterMm'), '12')
  await expect(fieldBox(page, 'columnGutterMm')).toHaveAttribute(
    'data-source',
    'spread',
  )

  await setMasterColumns(page, '4')
  await expect.poll(async () => (await spreadsAt(page, 4)).length).toBe(40)

  await selectSpread(page, OWN)
  await expect(section.getByRole('radio', { name: 'Custom' })).toBeChecked()
  await expect(input(page, 'columns')).toHaveValue('4')
  await expect(input(page, 'columnGutterMm')).toHaveValue('12')
  await expect(input(page, 'columnGutterMm')).toHaveCSS('font-weight', '600')

  await page.getByTestId('spread-grid-reset-columnGutterMm').click()
  await expect(input(page, 'columnGutterMm')).toHaveValue('5')
  await expect(fieldBox(page, 'columnGutterMm')).toHaveAttribute(
    'data-source',
    'book',
  )
  await expect(
    page.getByTestId('spread-grid-reset-columnGutterMm'),
  ).toHaveCount(0)
  // The last override is gone; Custom stays until the spread changes.
  await expect(section.getByRole('radio', { name: 'Custom' })).toBeChecked()
  await assertDocumentFitsViewport(page)
})

test('GP1: spread Custom fields match the kit GridFields rects (±0.5 px); ↺ shifts nothing', async ({
  page,
}, testInfo) => {
  await page.goto('/?fixture=painter&parent=a')
  await selectSpread(page, OWN)
  await openCustom(page)
  const origin = await box(fieldBox(page, 'columns'))
  const rel = async (locator: Locator) => {
    const rect = await box(locator)
    return {
      x: rect.x - origin.x,
      y: rect.y - origin.y,
      width: rect.width,
      height: rect.height,
    }
  }
  const near = (actual: number, expected: number) => {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5)
  }
  const fields = ['columns', 'rows', 'columnGutterMm', 'rowGutterMm']
  const margins = ['top', 'bottom', 'inside', 'outside']
  // Kit `#/demo` spread Grid Custom (Designer evidence kit.json), relative
  // to the C field: 2 columns 130 + 8 + 130, rows on a 40 px pitch.
  const expected: Record<string, [number, number]> = {
    columns: [0, 0],
    rows: [138, 0],
    columnGutterMm: [0, 40],
    rowGutterMm: [138, 40],
    top: [0, 120],
    bottom: [138, 120],
    inside: [0, 160],
    outside: [138, 160],
  }
  const measure = async () => {
    const rects: Record<string, Awaited<ReturnType<typeof rel>>> = {}
    for (const name of [...fields, ...margins]) {
      rects[name] = await rel(fieldBox(page, name))
    }
    return rects
  }
  const before = await measure()
  for (const [name, [x, y]] of Object.entries(expected)) {
    const rect = before[name]
    near(rect?.x ?? NaN, x)
    near(rect?.y ?? NaN, y)
    near(rect?.width ?? NaN, 130)
    near(rect?.height ?? NaN, 32)
  }
  // Block C…O is 192 px tall (prod was 232).
  near((before.outside?.y ?? NaN) + (before.outside?.height ?? NaN), 192)
  const columns = await rel(input(page, 'columns'))
  near(columns.x, 30)
  near(columns.width, 90)
  // Value box from x 30 up to the unit, the unit ends at the 10 px padding
  // (the unit glyph width is font-rendered, so it is not pinned here).
  const gutter = await rel(input(page, 'columnGutterMm'))
  const unit = await rel(
    fieldBox(page, 'columnGutterMm').getByText('mm', { exact: true }),
  )
  near(gutter.x, 30)
  near(gutter.x + gutter.width + 8, unit.x)
  near(unit.x + unit.width, 120)
  const section = page.getByTestId('grid-section-spread')
  near((await rel(section.getByText('Margins', { exact: true }))).y, 88.58)
  const link = await rel(page.getByTestId('spread-grid-link'))
  near(link.x, 240)
  near(link.y, 84)
  near(link.width, 28)
  near(link.height, 28)
  const hint = page.getByTestId('spread-grid-hint')
  await expect(hint).toHaveText('Grey values follow Master A.')
  const hintRect = await rel(hint)
  near(hintRect.y, 198)
  near(hintRect.height, 16)
  await expect(hint).toHaveCSS('font-size', '11px')
  await expect(hint).toHaveCSS('color', GREY)

  // GP2: grey 400 until set here, then dark 600 + ↺ inside the same box.
  await expect(input(page, 'rowGutterMm')).toHaveCSS('color', GREY)
  await expect(input(page, 'rowGutterMm')).toHaveCSS('font-weight', '400')
  await commit(input(page, 'rowGutterMm'), '12.5')
  await expect(input(page, 'rowGutterMm')).toHaveCSS('color', DARK)
  await expect(input(page, 'rowGutterMm')).toHaveCSS('font-weight', '600')
  const resetButton = page.getByTestId('spread-grid-reset-rowGutterMm')
  const reset = await rel(resetButton)
  near(reset.width, 16)
  near(reset.height, 16)
  // Narrowest case RG 12.5 mm ↺ still fits: the value box keeps ≥ 31.2 px.
  expect((await rel(input(page, 'rowGutterMm'))).width).toBeGreaterThanOrEqual(
    31.2,
  )
  near(reset.x + reset.width, 138 + 130 - 10)
  expect(await measure()).toEqual(before)
  // GP3 keyboard: Tab from the input reaches its ↺.
  await input(page, 'rowGutterMm').focus()
  await page.keyboard.press('Tab')
  await expect(resetButton).toBeFocused()
  await expect(resetButton).toHaveCSS('outline', `${GREY} solid 2px`)
  await assertDocumentFitsViewport(page)
  await section.screenshot({ path: testInfo.outputPath('spread-grid.png') })
})
