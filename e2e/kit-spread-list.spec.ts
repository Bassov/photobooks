import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit spread list (moved from uikit/scripts/qa.mjs v7 / v0.7.1 / kit10,
// uikit-qa-split-2): the list order Cover · Endpaper · pages · Endpaper, the
// selected / hover row tone, the feature page's Pages/Masters list, and in
// #/demo the row menu and the drag-source list without an Add spread row.
// Smoke ports also fail on a console error / warning, page error or failed
// request, like the qa.mjs smoke() helper.

test.use({ viewport: { width: 1440, height: 900 } })

const demo = (page: Page) => page.getByTestId('demo')
const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const rows = (page: Page) => E(page, '[data-testid="panel-l"] [role=row]')
const items = (page: Page) =>
  rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-item')))

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

async function open(page: Page, hash: string) {
  const errs = watchErrors(page)
  await page.goto(`/uikit/${hash}`)
  await expect(demo(page)).toBeVisible()
  return errs
}

/** kit10 walk opening: fresh #/demo, library, a new book, a photo folder, spread p1 */
async function openKit10(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click() // dialogs portal outside the demo root
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c('[data-testid="demo"] [data-testid="new-book"]')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="p1"]')
}

test('v7 list order: Cover · Endpaper · page 1 · spreads · last page · Endpaper', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await expect(rows(page).first()).toBeVisible()
  const it = await items(page)
  const labels = await E(
    page,
    '[data-testid="panel-l"] [role=row] [data-label]',
  ).allInnerTexts()
  expect(
    [it[0], it[1], it[2], it.at(-3), it.at(-2), it.at(-1)],
    it.join(','),
  ).toEqual(['cover', 'ef', 'p0', 'p9', 'last', 'eb'])
  expect(
    [labels[2], labels[3], labels.at(-3), labels.at(-2)],
    labels.join(','),
  ).toEqual(['1', '2–3', '18–19', '20'])
  expect(errs).toEqual([])
})

test('v7 selection: list row #CACACA + bold, no outline; hover #D7D7D7', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  const sel = E(page, '[data-testid="panel-l"] [role=row][aria-selected=true]')
  await expect(sel).toHaveCSS('background-color', 'rgb(202, 202, 202)')
  await expect(sel).toHaveCSS('outline-style', 'none')
  const fw = await sel
    .locator('[data-label]')
    .evaluate((e) => getComputedStyle(e).fontWeight)
  expect(+fw).toBeGreaterThanOrEqual(600)
  const other = E(
    page,
    '[data-testid="panel-l"] [role=row][aria-selected=false]',
  ).first()
  await other.hover()
  await expect(other).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  expect(errs).toEqual([])
})

test('v7.1 P1 #3: feature page uses the new list (Pages/Masters seg, page labels) and inspector', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/spread-list-panel')
  const labels = D(page, '[data-testid="panel-l"] [role=row] [data-label]')
  await expect(labels.first()).toBeVisible()
  await expect(D(page, '[data-testid="mode-seg"]')).toHaveCount(1)
  await expect(D(page, '[data-testid="editor-bar"]')).toHaveCount(1)
  expect(await labels.allInnerTexts()).toEqual(
    expect.arrayContaining(['1', '2–3']),
  )
  expect(errs).toEqual([])
})

test('kit10: spread row menu offers Add after / Duplicate / Delete; the list is a drag source with 0 Add spread rows (KS8)', async ({
  page,
}) => {
  await openKit10(page)
  await D(page, '[data-item="p1"]').hover()
  await page
    .locator('[data-item="p1"] [data-testid="spread-menu"]')
    .first()
    .click()
  const menu = page.getByRole('menuitem')
  await expect(menu.first()).toBeVisible()
  expect(
    (await menu.allInnerTexts()).filter((t) =>
      /Add after|Duplicate|Delete/.test(t),
    ),
  ).toHaveLength(3)
  await page.getByRole('menuitem', { name: /Duplicate/ }).click()
  await expect(menu).toHaveCount(0)
  // kit-sync KS8 (M17): the spread list ends without the Add spread + Ctrl+↵ row (the row menu Add after stays)
  const addRows =
    (await D(page, '[data-testid="panel-l"]')
      .getByText(/^Add spread$|^Ctrl\+↵$/)
      .count()) + (await D(page, '[data-testid="add-spread"]').count())
  expect(
    await D(page, '[data-testid="panel-l"] button')
      .filter({ hasText: 'Drag' })
      .count(),
  ).toBeGreaterThan(0)
  expect(addRows).toBe(0)
})
