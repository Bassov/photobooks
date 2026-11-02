import type { Locator, Page } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'

// parent-spreads-edit: the painter fixture has parents "Master A" (a logo)
// and "Master B" (empty); Pages is cut to 20 so the book has 10 spreads.
const SPREADS = Array.from(
  { length: 10 },
  (_, i) => `painter-spread-${String(i)}`,
)
const masterCanvas = (page: Page) =>
  page.getByTestId('masters-canvas').getByTestId('spread-view')
const masterFrames = (page: Page) =>
  masterCanvas(page).locator('button.spread-frame')
const canvasSpread = (page: Page, id: string) =>
  page.locator(`[data-testid="spread-view"][data-spread-id="${id}"]`)
const canvasLogo = (page: Page, id: string) =>
  canvasSpread(page, id).locator('[data-testid="parent-layer"] .spread-frame')
const masterRows = (page: Page) =>
  page.getByRole('listbox', { name: 'Masters' }).getByRole('option')

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (rect === null) {
    throw new Error('not visible')
  }
  return rect
}

/** Left / top of `item` in mm from its spread's top-left (mm from the spread height). */
async function offsetMm(spread: Locator, item: Locator, trimHeightMm: number) {
  const outer = await box(spread)
  const inner = await box(item)
  const pxPerMm = outer.height / trimHeightMm
  return {
    x: (inner.x - outer.x) / pxPerMm,
    y: (inner.y - outer.y) / pxPerMm,
  }
}

async function openPainterWithTenSpreads(page: Page): Promise<number> {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  await field.fill('20')
  await field.press('Enter')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '10',
  )
  return Number(await page.getByTestId('size-h').inputValue()) * 10
}

async function applyMaster(page: Page, spreadId: string, name: string) {
  const row = page.getByTestId(`spread-list-item-${spreadId}`)
  await row.scrollIntoViewIfNeeded()
  await row.click()
  await expect(canvasSpread(page, spreadId)).toBeVisible()
  const radio = page
    .getByRole('radiogroup', { name: 'Master' })
    .getByRole('radio', { name, exact: true })
  await radio.check({ force: true })
  await expect(radio).toBeChecked()
}

/** The logo's offset (mm) on every spread, read on the canvas one by one. */
async function logoOffsets(page: Page, trimHeightMm: number) {
  const offsets: { x: number; y: number }[] = []
  // The list is windowed: start at the top so each next row is mounted.
  await page.getByTestId('spreads-list').evaluate((list) => {
    list.scrollTop = 0
  })
  for (const id of SPREADS) {
    const row = page.getByTestId(`spread-list-item-${id}`)
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await expect(canvasLogo(page, id)).toHaveCount(1)
    offsets.push(
      await offsetMm(
        canvasSpread(page, id),
        canvasLogo(page, id),
        trimHeightMm,
      ),
    )
  }
  return offsets
}

test('Browser check: a logo added to a master and moved once moves on every spread', async ({
  page,
}) => {
  // Ten spreads are visited three times (apply, before, after).
  test.setTimeout(120_000)
  const trimHeightMm = await openPainterWithTenSpreads(page)

  // Masters mode: the fixture masters, first one shown; New master adds C.
  await page.getByTestId('left-tab-masters').click()
  await expect(masterRows(page)).toHaveText(['Master A', 'Master B'])
  await expect(masterRows(page).first()).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'New master' }).click()
  await expect(masterRows(page)).toHaveText([
    'Master A',
    'Master B',
    'Master C',
  ])
  await expect(masterRows(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(masterFrames(page)).toHaveCount(0)
  await expect(page.getByTestId('inspector-empty')).toContainText(
    'Master items show on every spread',
  )

  // Add the logo: the Frame tool draws on the master like on a spread.
  const master = await box(masterCanvas(page))
  await page.keyboard.press('f')
  await page.mouse.move(master.x + master.width * 0.6, master.y + 20)
  await page.mouse.down()
  await page.mouse.move(master.x + master.width * 0.7, master.y + 60, {
    steps: 4,
  })
  await page.mouse.up()
  await page.keyboard.press('v')
  await expect(masterFrames(page)).toHaveCount(1)

  // Apply Master C to every spread.
  await page.getByTestId('left-tab-pages').click()
  for (const id of SPREADS) {
    await applyMaster(page, id, 'Master C')
  }
  const before = await logoOffsets(page, trimHeightMm)

  // Move the logo once in Masters mode (an empty frame moves by its body).
  await page.getByTestId('left-tab-masters').click()
  await expect(masterRows(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  const logo = masterFrames(page).first()
  const start = await box(logo)
  const masterPxPerMm = (await box(masterCanvas(page))).height / trimHeightMm
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    start.x + start.width / 2 + 30 * masterPxPerMm,
    start.y + start.height / 2 + 20 * masterPxPerMm,
    { steps: 6 },
  )
  await page.mouse.up()
  const end = await box(logo)
  const moved = {
    x: (end.x - start.x) / masterPxPerMm,
    y: (end.y - start.y) / masterPxPerMm,
  }
  expect(moved.x).toBeGreaterThan(20)
  expect(moved.y).toBeGreaterThan(10)
  await assertDocumentFitsViewport(page)

  // Every spread shows the logo moved by the same mm.
  await page.getByTestId('left-tab-pages').click()
  const after = await logoOffsets(page, trimHeightMm)
  const deltas = after.map((offset, i) => ({
    x: offset.x - (before[i]?.x ?? NaN),
    y: offset.y - (before[i]?.y ?? NaN),
  }))
  expect(
    deltas.every(
      (d) => Math.abs(d.x - moved.x) <= 0.5 && Math.abs(d.y - moved.y) <= 0.5,
    ),
  ).toBe(true)
  await assertDocumentFitsViewport(page)
})

test('Masters list: rename and delete a master; its spreads fall back to None', async ({
  page,
}) => {
  await openPainterWithTenSpreads(page)
  await applyMaster(page, 'painter-spread-1', 'Master A')
  await expect(canvasLogo(page, 'painter-spread-1')).toHaveCount(1)

  // Rename from the row menu.
  await page.getByTestId('left-tab-masters').click()
  await page.getByTestId('master-list-item-painter-parent-a').hover()
  await page.getByTestId('master-menu-painter-parent-a').click()
  await page.getByTestId('master-menu-rename').click()
  const input = page.getByTestId('master-rename-input')
  await expect(input).toBeFocused()
  await input.fill('Logo page')
  await input.press('Enter')
  await expect(masterRows(page)).toHaveText(['Logo page', 'Master B'])
  await expect(masterCanvas(page)).toHaveAttribute(
    'data-spread-id',
    'painter-parent-a',
  )
  await expect(masterFrames(page)).toHaveCount(1)

  // Delete it: Master B is shown, the spread paints no parent layer.
  await page.getByTestId('master-menu-painter-parent-a').click()
  await page.getByTestId('master-menu-delete').click()
  await expect(masterRows(page)).toHaveText(['Master B'])
  await expect(masterCanvas(page)).toHaveAttribute(
    'data-spread-id',
    'painter-parent-b',
  )
  await page.getByTestId('left-tab-pages').click()
  await page.getByTestId('spread-list-item-painter-spread-1').click()
  await expect(
    canvasSpread(page, 'painter-spread-1').getByTestId('parent-layer'),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('radiogroup', { name: 'Master' })
      .getByRole('radio', { name: 'None', exact: true }),
  ).toBeChecked()
  await assertDocumentFitsViewport(page)
})

test('Masters list: many masters scroll inside the list, the page does not', async ({
  page,
}) => {
  await openPainterWithTenSpreads(page)
  await page.getByTestId('left-tab-masters').click()
  // 2 fixture masters + 16 new rows of ~100 px thumbs overflow any viewport.
  for (let added = 0; added < 16; added += 1) {
    await page.getByTestId('new-master').click()
  }
  await expect(masterRows(page)).toHaveCount(18)
  await assertNamedScrollport(page, 'masters-list', { axis: 'vertical' })
  await expect(page.getByTestId('new-master')).toBeInViewport()
  await assertDocumentFitsViewport(page)
})
