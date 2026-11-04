import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// master-spread-both-pages (Owner 2026-11-04): a new master with a grid,
// applied to a two-page spread, showed its grid on the left page only — the
// painter's 4-grid frames (z 0–3) covered the overlay. Spread 0 is the single
// first page, spread 1 a two-page interior spread.
test.use({ viewport: { width: 1440, height: 900 } })

const spreadView = (page: Page, spreadId: string) =>
  page
    .getByTestId('pasteboard-scroll')
    .locator(`[data-testid="spread-view"][data-spread-id="${spreadId}"]`)

async function newMasterWithColumns(page: Page, columns: string) {
  await page.getByTestId('left-tab-masters').click()
  await page.getByTestId('new-master').click()
  const field = page.getByTestId('master-field-columns')
  await field.fill(columns)
  await field.press('Enter')
  await expect(field).toHaveValue(columns)
  await page.getByTestId('left-tab-pages').click()
}

async function applyMaster(page: Page, spreadId: string, name: string) {
  await page.getByTestId(`spread-list-item-${spreadId}`).click()
  const master = page.getByTestId('spread-master-spacing')
  await master.getByText(name, { exact: true }).click()
  await expect(master.getByRole('radio', { name })).toBeChecked()
}

interface PageReport {
  columns: number
  /** First column's left edge, px from the spread's left edge. */
  firstColumnLeft: number
  /** A spread frame lies under the probe point in the first column. */
  overFrame: boolean
  /** At the probe point the grid column paints above every frame. */
  gridOnTop: boolean
}

/**
 * Per grid page: columns, first column offset and paint order at a probe point
 * in the first column.
 * Grid rects take no pointer events, so the SVG is made hit-testable for the
 * `elementsFromPoint` read only.
 */
async function gridPages(view: Locator): Promise<PageReport[]> {
  await view.scrollIntoViewIfNeeded()
  return view.evaluate((node) => {
    const svg = node.querySelector<SVGSVGElement>(
      '[data-testid="grid-overlay"]',
    )
    if (svg === null) {
      return []
    }
    const left = node.getBoundingClientRect().left
    svg.style.pointerEvents = 'auto'
    const pages = [
      ...svg.querySelectorAll('[data-testid="grid-overlay-page"]'),
    ].map((group) => {
      const columns = group.querySelectorAll(
        '[data-testid="grid-overlay-column"]',
      )
      const first = columns[0]?.getBoundingClientRect()
      if (first === undefined) {
        return {
          columns: 0,
          firstColumnLeft: -1,
          overFrame: false,
          gridOnTop: false,
        }
      }
      const stack = document.elementsFromPoint(
        first.left + first.width / 2,
        // A quarter down: the 4-grid's row gap runs through the middle.
        first.top + first.height / 4,
      )
      const column = stack.findIndex((el) => el === columns[0])
      const frame = stack.findIndex((el) => el.closest('[data-frame-id]'))
      return {
        columns: columns.length,
        firstColumnLeft: first.left - left,
        overFrame: frame !== -1,
        gridOnTop: column !== -1 && (frame === -1 || column < frame),
      }
    })
    svg.style.pointerEvents = ''
    return pages
  })
}

test('a master grid shows on both pages of a two-page spread and on the single first page', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await newMasterWithColumns(page, '3')
  await applyMaster(page, 'painter-spread-1', 'Master C')
  await applyMaster(page, 'painter-spread-0', 'Master C')
  await page.getByTestId('grid-topbar-toggle').click()

  const inner = spreadView(page, 'painter-spread-1')
  const width = (await inner.boundingBox())?.width ?? 0
  const pages = await gridPages(inner)
  const order = (p: PageReport) => [p.columns, p.overFrame, p.gridOnTop]
  expect(pages.map(order)).toEqual([
    [3, true, true],
    [3, true, true],
  ])
  expect(pages[0]?.firstColumnLeft).toBeLessThan(width / 2)
  expect(pages[1]?.firstColumnLeft).toBeGreaterThan(width / 2)

  const first = spreadView(page, 'painter-spread-0')
  expect((await gridPages(first)).map(order)).toEqual([[3, true, true]])
})
