import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { expectKitSwitchSm } from './fixtures/switchGeometry'

// design-r18-kit-toggle (Designer live-captions M94): every kit `#/demo`
// inspector `Toggle` is the kit `Switch size="sm"` that prod uses since #518:
// 36×20 track, 16 px knob at +2 off / +18 on, right edge 1424 at 1440 wide,
// and its 18.84 px rows keep their height (the track sits in -1 px margins).

test.use({ viewport: { width: 1440, height: 900 } })

const RIGHT_EDGE = 1424
const ROW_HEIGHT = 18.84

const demo = (page: Page) => page.getByTestId('demo')
const knobOf = (track: Locator) => track.locator('.e7-knob')

async function openDemoBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

/** Track right edge and the height of the inspector `Row` holding it. */
async function placement(track: Locator) {
  return track.evaluate((el) => {
    const t = el.getBoundingClientRect()
    const row = el.parentElement?.getBoundingClientRect()
    return { right: t.right, rowHeight: row?.height ?? 0 }
  })
}

async function expectPlaced(track: Locator) {
  const p = await placement(track)
  expect(p.right).toBeCloseTo(RIGHT_EDGE, 0)
  expect(p.rowHeight).toBeCloseTo(ROW_HEIGHT, 1)
}

test.describe('#/demo inspector toggles', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoBook(page)
  })

  test('Book settings toggles are the Switch sm box off, on and after a click', async ({
    page,
  }) => {
    await demo(page).getByTestId('book-title').click()
    const endpapers = demo(page).getByRole('switch', { name: 'Endpapers' })
    const skipFirst = demo(page).getByTestId('book-pn-skip-first')
    await expect(endpapers).toHaveAttribute('aria-checked', 'true')
    await expect(skipFirst).toHaveAttribute('aria-checked', 'false')
    await expectKitSwitchSm(endpapers, knobOf(endpapers), true)
    await expectKitSwitchSm(skipFirst, knobOf(skipFirst), false)
    await expectPlaced(endpapers)
    await expectPlaced(skipFirst)

    await skipFirst.click()
    await expect(skipFirst).toHaveAttribute('aria-checked', 'true')
    await expectKitSwitchSm(skipFirst, knobOf(skipFirst), true)
    await endpapers.click()
    await expect(endpapers).toHaveAttribute('aria-checked', 'false')
    await expectKitSwitchSm(endpapers, knobOf(endpapers), false)
  })

  test('the master Page numbers toggle is the Switch sm box', async ({
    page,
  }) => {
    await demo(page).getByTestId('mode-seg').locator('button').nth(1).click()
    const show = demo(page).getByTestId('master-pn-toggle')
    await expect(show).toHaveAttribute('aria-checked', 'false')
    await expectKitSwitchSm(show, knobOf(show), false)
    await expectPlaced(show)

    await show.click()
    await expect(show).toHaveAttribute('aria-checked', 'true')
    await expectKitSwitchSm(show, knobOf(show), true)
  })

  test('a keyboard-focused toggle shows the 2 px ring at offset 2', async ({
    page,
  }) => {
    await demo(page).getByTestId('book-title').click()
    const skipFirst = demo(page).getByTestId('book-pn-skip-first')
    await skipFirst.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(skipFirst).toBeFocused()
    await expect(skipFirst).toHaveCSS('outline-style', 'solid')
    await expect(skipFirst).toHaveCSS('outline-width', '2px')
    await expect(skipFirst).toHaveCSS('outline-offset', '2px')
  })
})

// v7 toggle + swatch tones (moved from uikit/scripts/qa.mjs v7, uikit-qa-split-2):
// Switch ON #A8A8A8 / OFF #CACACA / knob #F7F7F7 in the editor and the kit
// component, the selected swatch's 2 px #8E8E8E ring at offset 2. These also
// fail on a console error / warning, page error or failed request, like the
// qa.mjs smoke() helper.

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

/** qa.mjs scen(): the old editor scenario `tab` now lives on feature page `slug` */
async function scen(page: Page, slug: string, tab: string) {
  await page.goto(`/uikit/#/feature/${slug}`)
  const t = demo(page)
    .getByTestId('scenarios')
    .getByRole('tab', { name: tab, exact: true })
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
}

/** the selected swatch ring; with no wired swatch rendered, the `.swatch-on` rule itself */
function swatchRing() {
  const ring = (e: Element) => {
    const c = getComputedStyle(e)
    return `${c.outlineWidth} ${c.outlineStyle} ${c.outlineColor} ${c.outlineOffset}`
  }
  const on = document.querySelector(
    '[data-testid="demo"] [data-testid="editor7"] [data-testid="bg-swatches"] .swatch-on',
  )
  if (on) return ring(on)
  const el = document.createElement('span')
  el.className = 'swatch-on'
  document.body.appendChild(el)
  const r = ring(el)
  el.remove()
  return r
}

/** #/components: [selected?, track bg, knob bg] of every kit Switch */
function componentSwitches() {
  return [...document.querySelectorAll('.sw-track')].map((e) => [
    e.closest('[data-selected]') ? 1 : 0,
    getComputedStyle(e).backgroundColor,
    e.firstElementChild
      ? getComputedStyle(e.firstElementChild).backgroundColor
      : '',
  ])
}

test('v7 toggles: ON #A8A8A8, OFF #CACACA, knob #F7F7F7; selected swatch 2px #8E8E8E ring with 2px offset', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/screen/canvas')
  await expect(demo(page)).toBeVisible()
  await scen(page, 'inspector', 'Book settings')
  const sw = demo(page).locator(
    '[data-testid="editor7"] [role=switch][aria-label="Endpapers"]',
  )
  await expect(sw).toHaveCSS('background-color', 'rgb(168, 168, 168)')
  await sw.click()
  await expect(sw).toHaveCSS('background-color', 'rgb(202, 202, 202)')
  await expect(sw.locator('span')).toHaveCSS(
    'background-color',
    'rgb(247, 247, 247)',
  )
  await sw.click()
  // v0.9.1: Binding/Material/Fill demoted (no fake book swatches). .swatch-on still styles wired spread Background chips.
  await scen(page, 'frame-selection-handles', 'Frame selected')
  await demo(page)
    .getByTestId('canvas')
    .click({ position: { x: 20, y: 20 } })
  await expect
    .poll(() => page.evaluate(swatchRing))
    .toBe('2px solid rgb(142, 142, 142) 2px')
  expect(errs).toEqual([])
})

test('v7 kit Switch component: ON #A8A8A8 / OFF #CACACA / knob #F7F7F7', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/feature/editor-chrome-toolbar')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    location.hash = '#/components'
  })
  await expect(page.locator('.sw-track').first()).toBeVisible()
  const r = await page.evaluate(componentSwitches)
  expect(r.length).toBeGreaterThanOrEqual(2)
  expect(
    r.filter(
      ([s, b, k]) =>
        b !== (s ? 'rgb(168, 168, 168)' : 'rgb(202, 202, 202)') ||
        k !== 'rgb(247, 247, 247)',
    ),
  ).toEqual([])
  expect(errs).toEqual([])
})
