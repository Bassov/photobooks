import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { pickMaster } from './fixtures/spreadMaster'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

// parent-spreads-inspector (Designer Spec I1, MS1–MS9): `&parent=a` makes
// Master A the book default, so all 40 painter spreads use it. The fixture
// book grid is 2 × 2 with equal 15 mm margins.
const NONE_SPREAD = 'painter-spread-3'

test.use({ viewport: { width: 1440, height: 900 } })

const inspector = (page: Page) => page.getByTestId('inspector-panel')
const masterField = (page: Page, field: string) =>
  page.getByTestId(`master-field-${field}`)
const masterCells = (page: Page) =>
  page.getByTestId('masters-canvas').getByTestId('grid-overlay-cell')
const masterLogo = (page: Page) =>
  page.getByTestId('masters-canvas').locator('button.spread-frame').first()

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (rect === null) {
    throw new Error('not visible')
  }
  return rect
}

async function commitField(page: Page, field: string, value: string) {
  const input = masterField(page, field)
  await input.fill(value)
  await input.press('Enter')
  await expect(input).toHaveValue(value)
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

/** Width share of each mounted spread taken by its first template frame, by id. */
async function frameShares(page: Page): Promise<Record<string, number>> {
  return page
    .getByTestId('pasteboard-scroll')
    .locator('[data-testid="spread-view"]')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => {
          const id = node.getAttribute('data-spread-id') ?? ''
          const frame = node.querySelector(`[data-frame-id="${id}-f0"]`)
          const width = node.getBoundingClientRect().width
          return [
            id,
            frame === null || width === 0
              ? 0
              : frame.getBoundingClientRect().width / width,
          ]
        }),
      ),
    )
}

/** Ids whose first frame share changed between two `frameShares` reads. */
function movedSpreads(
  before: Record<string, number>,
  after: Record<string, number>,
): string[] {
  return Object.keys(before).filter(
    (id) => Math.abs((after[id] ?? 0) - (before[id] ?? 0)) > 0.001,
  )
}

async function setSpreadNone(page: Page, spreadId: string) {
  await page.getByTestId(`spread-list-item-${spreadId}`).click()
  await pickMaster(page, 'None')
}

test('Browser check: Master A at 5 columns shows on the master and every spread using it', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await mountAllSpreads(page)
  await setSpreadNone(page, NONE_SPREAD)
  await page.getByTestId('grid-topbar-toggle').click()

  await page.getByTestId('left-tab-masters').click()
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'master')
  const head = page.getByTestId('insp-master').getByTestId('inspector-head')
  await expect(head.getByTestId('inspector-context')).toHaveText('Master A')
  // 40 spreads: 1 + 38 × 2 + 1 pages, minus the None spread's 2 (default-master I1).
  await expect(head.getByTestId('master-usage')).toHaveText(
    'Default · 76 of 78 pages',
  )
  await expect(page.getByTestId('master-label')).toHaveText('Master A')
  // The master grid is drawn although the toolbar Grid is what the user set.
  await expect(masterCells(page)).toHaveCount(8)

  await commitField(page, 'rows', '1')
  await expect(masterCells(page)).toHaveCount(4)
  await commitField(page, 'columns', '5')
  await expect(masterCells(page)).toHaveCount(10)
  await assertDocumentFitsViewport(page)

  await page.getByTestId('left-tab-pages').click()
  await expect
    .poll(async () => {
      const columns = await columnsPerPage(page)
      return Object.entries(columns).filter(
        ([id, pages]) =>
          id !== NONE_SPREAD && pages.length > 0 && pages.every((n) => n === 5),
      ).length
    })
    .toBe(39)
  const columns = await columnsPerPage(page)
  expect(columns[NONE_SPREAD]).toEqual([2, 2])
  expect(Object.keys(columns)).toHaveLength(40)
  await assertDocumentFitsViewport(page)
})

test('GP7: a Master A gutter edit re-aligns the frames of every spread using it', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await mountAllSpreads(page)
  await setSpreadNone(page, NONE_SPREAD)
  const before = await frameShares(page)
  expect(Object.keys(before)).toHaveLength(40)

  await page.getByTestId('left-tab-masters').click()
  await commitField(page, 'columnGutterMm', '24')
  await page.getByTestId('left-tab-pages').click()

  await expect
    .poll(async () => movedSpreads(before, await frameShares(page)))
    .toHaveLength(39)
  const moved = movedSpreads(before, await frameShares(page))
  expect(moved).not.toContain(NONE_SPREAD)
})

test('MS2: master inspector rects match the Designer Spec (±0.5 px)', async ({
  page,
}, testInfo) => {
  await page.goto('/?fixture=painter&parent=a')
  await page.getByTestId('left-tab-masters').click()
  const root = page.getByTestId('insp-master')
  await expect(root).toBeVisible()
  const origin = await box(root)
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
  const title = await rel(root.getByTestId('inspector-context'))
  near(title.x, 16)
  near(title.y, 16)
  near((await rel(root.getByTestId('master-usage'))).y, 36.84)
  near((await rel(root.getByRole('heading', { name: 'Grid' }))).y, 73.64)

  const field = (name: string) => rel(masterField(page, name).locator('..'))
  const rows: [string, number][] = [
    ['columns', 100.48],
    ['rows', 100.48],
    ['columnGutterMm', 140.48],
    ['rowGutterMm', 140.48],
    ['top', 220.48],
    ['bottom', 220.48],
    ['inside', 260.48],
    ['outside', 260.48],
  ]
  for (const [name, top] of rows) {
    const box = await field(name)
    near(box.y, top)
    near(box.width, 130)
    near(box.height, 32)
  }
  near((await field('rows')).x, 154)
  near((await rel(root.getByText('Margins', { exact: true }))).y, 189.06)
  const link = await rel(masterField(page, 'link'))
  near(link.x, 256)
  near(link.y, 184.48)
  near(link.width, 28)
  near(link.height, 28)
  const grid = await rel(page.getByTestId('master-grid'))
  near(grid.y + grid.height, 308.48)
  await expect(masterField(page, 'link')).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // MS3 keyboard focus: the field rings + underlines; Tab reaches the link.
  await masterField(page, 'rowGutterMm').focus()
  const rg = masterField(page, 'rowGutterMm')
  await expect(rg.locator('..')).toHaveCSS(
    'box-shadow',
    'rgb(83, 81, 82) 0px 0px 0px 1px inset',
  )
  await expect(rg).toHaveCSS('text-decoration-line', 'underline')
  await expect(masterField(page, 'columns').locator('..')).toHaveCSS(
    'box-shadow',
    'none',
  )
  await page.keyboard.press('Tab')
  await expect(masterField(page, 'link')).toBeFocused()
  await expect(masterField(page, 'link')).toHaveCSS(
    'outline',
    'rgb(83, 81, 82) solid 2px',
  )
  await page.keyboard.press('Enter')
  await expect(masterField(page, 'link')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await root.screenshot({ path: testInfo.outputPath('insp-master.png') })
})

test('MS7: a master item opens the Photo inspector; Esc or an empty click returns', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await page.getByTestId('left-tab-masters').click()
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'master')

  await masterLogo(page).click()
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'frame')
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.keyboard.press('Escape')
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'master')

  await masterLogo(page).click()
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'frame')
  const spread = await box(
    page.getByTestId('masters-canvas').getByTestId('spread-view'),
  )
  await page.mouse.click(
    spread.x + spread.width * 0.25,
    spread.y + spread.height * 0.6,
  )
  await expect(inspector(page)).toHaveAttribute('data-inspector-view', 'master')
  await assertDocumentFitsViewport(page)
})

test('MS8: with no masters the inspector shows the New master hint', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await page.getByTestId('left-tab-masters').click()
  for (const id of ['painter-parent-a', 'painter-parent-b']) {
    await page.getByTestId(`master-list-item-${id}`).hover()
    await page.getByTestId(`master-menu-${id}`).click()
    await page.getByTestId('master-menu-delete').click()
  }
  await expect(page.getByTestId('masters-canvas-empty')).toBeVisible()
  await expect(inspector(page)).toHaveAttribute(
    'data-inspector-view',
    'masters',
  )
  await expect(page.getByTestId('inspector-empty')).toHaveText(
    'Create a master with New master to set its grid.',
  )
})

test.describe('frame-budget gates', () => {
  test('editing the grid of a master used by 40 spreads stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1&parent=a')
    await mountAllSpreads(page)
    await page.getByTestId('grid-topbar-toggle').click()
    await page.getByTestId('left-tab-masters').click()
    await expect(masterCells(page)).toHaveCount(8)
    await clearPerfScenario(page)
    const before = await frameShares(page)

    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    for (const columns of ['3', '4', '5', '6', '5']) {
      await commitField(page, 'columns', columns)
    }
    // GP7 / GP8: gutter edits re-align the 4-grid frames of all 40 spreads.
    for (const gutter of ['12', '24']) {
      await commitField(page, 'columnGutterMm', gutter)
    }
    await expect(masterCells(page)).toHaveCount(20)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }),
    )
    const rows = await page.evaluate(browserTakeLoafScripts)
    const longest = Math.max(0, ...rows.map((row) => row.blocking))
    console.log(
      `parent-spreads-inspector: ${String(rows.length)} LoAF, longest blocking ${String(longest)} ms ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    await collectFrameStatsArtifact(page, testInfo)

    // Every spread using the master repainted its overlay.
    const columns = await columnsPerPage(page)
    expect(
      Object.values(columns).filter((pages) => pages.every((n) => n === 5)),
    ).toHaveLength(40)
    expect(movedSpreads(before, await frameShares(page))).toHaveLength(40)
  })
})
