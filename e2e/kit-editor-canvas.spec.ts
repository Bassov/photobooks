import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit editor canvas (moved from uikit/scripts/qa.mjs §4 / v5 / v6, uikit-qa-split-1):
// top-bar tooltips, the empty Spread inspector, drag a photo onto a frame, the grid
// toggle, the spread list panel and the selected-frame outline. Every test also fails
// on a console error / warning, page error or failed request, like the qa.mjs smoke().

test.use({ viewport: { width: 1440, height: 900 } })

const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)

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
  await expect(page.getByTestId('demo')).toBeVisible()
  return errs
}

/** 2 px selection-coloured (#393738) elements and any blue colour rendered in the demo */
function selectionAndBlue(): [number, string[]] {
  const cols = new Set<string>()
  let sel = 0
  for (const e of document.querySelectorAll('[data-testid=demo] *')) {
    const cs = getComputedStyle(e)
    if (
      (cs.outlineColor + cs.borderTopColor + cs.boxShadow).includes(
        'rgb(57, 55, 56)',
      ) &&
      (parseFloat(cs.outlineWidth) >= 2 ||
        parseFloat(cs.borderTopWidth) >= 2 ||
        cs.boxShadow.includes('2px'))
    )
      sel++
    for (const k of [
      'outlineColor',
      'borderTopColor',
      'boxShadow',
      'backgroundColor',
      'color',
    ] as const)
      for (const x of cs[k].match(/rgba?\(\d+, \d+, \d+/g) ?? []) {
        const [r = 0, g = 0, b = 0] = (x.match(/\d+/g) ?? []).map(Number)
        if (b - Math.max(r, g) > 30) cols.add(x)
      }
  }
  return [sel, [...cols]]
}

test('screen canvas: tooltips: at most 1 open while tabbing the top bar, none after Escape / leaving', async ({
  page,
}) => {
  await open(page, '#/screen/canvas')
  await page.locator('[data-testid="demo"] button').first().focus()
  let maxTips = 0
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(80)
    maxTips = Math.max(maxTips, await page.locator('[role=tooltip]').count())
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const afterEsc = await page.locator('[role=tooltip]').count()
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  await page.waitForTimeout(250)
  const afterLeave = await page.locator('[role=tooltip]').count()
  expect(maxTips).toBeLessThanOrEqual(1)
  expect(afterEsc).toBe(0)
  expect(afterLeave).toBe(0)
})

test('layout-grids-render-snap: empty inspector is labelled Spread, no stale hint block', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/layout-grids-render-snap')
  const insp = page
    .locator(
      '[data-testid="demo"] [data-testid="inspector"], [data-testid="demo"] [data-testid="ctx-inspector"]',
    )
    .first()
  // proto: a single section shows a plain header (h2) instead of a lone tab
  const tab = await insp
    .locator('[role="tab"], [data-testid="inspector-header"] h2')
    .first()
    .textContent()
  expect(tab).toBe('Spread')
  expect(await insp.innerText()).not.toContain('Select a frame on the spread')
  expect(errs).toEqual([])
})

test('drag-place-replace: drag photo onto frame + undo', async ({ page }) => {
  const errs = await open(page, '#/feature/drag-place-replace')
  await D(page, '[data-testid="filmstrip"] [role="row"]')
    .nth(0)
    .dragTo(D(page, '[data-testid="frame"]').first())
  await expect(D(page, '[data-testid="status"]').first()).toHaveText(
    /Placed|Replaced/,
  )
  await D(page, '[data-testid="undo"]').click()
  expect(errs).toEqual([])
})

test('layout-grids-render-snap: grid toggle', async ({ page }) => {
  const errs = await open(page, '#/feature/layout-grids-render-snap')
  const grid = D(page, '[data-testid="grid-overlay"]').first()
  await expect(grid).toBeVisible()
  await D(page, '[data-testid="toggle-grid"]').click()
  await expect(grid).toBeHidden()
  expect(errs).toEqual([])
})

test('spread-list-panel: v5.1 template names are not cut off (2 columns, wrap)', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/spread-list-panel')
  const cut = await D(page, '[data-testid="tpl-name"]').evaluateAll((els) =>
    els
      .filter(
        (e) =>
          (e as HTMLElement).offsetParent &&
          e.scrollHeight > e.clientHeight + 1,
      )
      .map((e) => e.textContent),
  )
  expect(cut).toEqual([])
  expect(errs).toEqual([])
})

test('spread-list-panel: v5 spread list: no horizontal scroll', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/spread-list-panel')
  const [sw, cw] = await D(page, '[data-testid="spreads-panel"] .scroll-thin')
    .first()
    .evaluate((e) => [e.scrollWidth, e.clientWidth])
  expect(sw).toBeLessThanOrEqual(cw + 1)
  expect(errs).toEqual([])
})

test('frame-selection-handles: v6 selected frame: #393738 outline, no blue rendered', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/frame-selection-handles')
  const [sel, blue] = await page.evaluate(selectionAndBlue)
  expect(blue).toEqual([])
  expect(sel).toBeGreaterThan(0)
  expect(errs).toEqual([])
})
