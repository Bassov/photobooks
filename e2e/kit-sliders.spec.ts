import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit sliders (moved from uikit/scripts/qa.mjs v7 / v8 / v8.1, uikit-qa-split-2):
// variant B look (3 px #CACACA track, #A8A8A8 fill → #8E8E8E dragging, 14 px
// #F7F7F7 knob, 4 px halo) in the editor and the kit Slider component, arrow /
// Shift / double-click keys, and double-click back to the real default.
// Smoke ports also fail on a console error / warning, page error or failed
// request, like the qa.mjs smoke() helper.

test.use({ viewport: { width: 1440, height: 900 } })

const SRC = path.resolve(process.cwd(), 'uikit', 'src')
const demo = (page: Page) => page.getByTestId('demo')
const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const bg = (loc: Locator) =>
  loc.evaluate((e) => getComputedStyle(e).backgroundColor)

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

/** qa.mjs scen("Photo"): the old editor scenario now lives on a feature page */
async function scenPhoto(page: Page) {
  await page.goto('/uikit/#/feature/frame-selection-handles')
  const tab = D(page, '[data-testid="scenarios"]').getByRole('tab', {
    name: 'Frame selected',
    exact: true,
  })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

/** #/components: every kit Slider track 3 px #CACACA, every thumb #F7F7F7 */
async function componentSliders(page: Page) {
  await page.evaluate(() => {
    location.hash = '#/components'
  })
  await expect(page.locator('.sl-track').first()).toBeVisible()
  return page.evaluate(() => {
    const t = [...document.querySelectorAll('.sl-track')]
    return {
      n: t.length,
      ok:
        t.every(
          (e) =>
            getComputedStyle(e).backgroundColor === 'rgb(202, 202, 202)' &&
            e.getBoundingClientRect().height === 3,
        ) &&
        [...document.querySelectorAll('.sl-thumb')].every(
          (e) => getComputedStyle(e).backgroundColor === 'rgb(247, 247, 247)',
        ),
    }
  })
}

const rangeOf = (sl: Locator) => sl.locator('input[type=range]').first()
const valueOf = async (sl: Locator) => +(await rangeOf(sl).inputValue())
const stepOf = async (sl: Locator) =>
  +((await rangeOf(sl).getAttribute('step')) ?? 1)

/** the value moves to `want` (within half a step) */
async function expectNear(sl: Locator, want: number, step: number) {
  await expect
    .poll(async () => Math.abs((await valueOf(sl)) - want) < step / 2)
    .toBe(true)
}

/** Shift+→ moves the slider off its default, double-click puts it back: [default, after Shift+→, after double-click] */
async function dbl(page: Page, loc: Locator) {
  const def = +((await loc.getAttribute('data-reset')) ?? NaN)
  await loc.hover()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(() => valueOf(loc)).not.toBe(def)
  const v1 = await valueOf(loc)
  await loc.dblclick()
  await expect.poll(() => valueOf(loc)).toBe(def)
  return [def, v1, await valueOf(loc)]
}

test('v7 sliders variant B: 3px #CACACA track, fill #A8A8A8 (#8E8E8E dragging), 14px #F7F7F7 knob, 4px halo, no black', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const sl = E(page, '.sl-track').first().locator('xpath=..')
  const tr = sl.locator('.sl-track')
  const fi = sl.locator('.sl-fill')
  const th = sl.locator('.sl-thumb')
  expect(await tr.evaluate((e) => e.getBoundingClientRect().height)).toBe(3)
  expect(await bg(tr)).toBe('rgb(202, 202, 202)')
  expect(await bg(fi)).toBe('rgb(168, 168, 168)')
  expect(await th.evaluate((e) => e.getBoundingClientRect().width)).toBe(14)
  expect(await bg(th)).toBe('rgb(247, 247, 247)')
  await page.mouse.move(1, 1)
  await th.hover() // v7.2: the inspector now opens with Crop (zoom) first — its slider can sit at the fold
  const bx = await th.boundingBox()
  expect(bx).not.toBeNull()
  const { x, y } = bx ?? { x: 0, y: 0 }
  await page.mouse.move(x + 7, y + 7)
  await page.mouse.down()
  await page.mouse.move(x + 30, y + 7, { steps: 4 })
  await expect(fi).toHaveCSS('background-color', 'rgb(142, 142, 142)')
  await expect(th).toHaveCSS('box-shadow', /0px 0px 0px 4px/)
  await page.mouse.up()
  const black = await page.evaluate(
    () =>
      [...document.querySelectorAll('.sl-track, .sl-fill, .sl-thumb')].filter(
        (e) =>
          /rgb\((3[0-9]|2[0-9]|[0-9]), /.test(
            getComputedStyle(e).backgroundColor,
          ),
      ).length,
  )
  expect(black).toBe(0)
  expect(errs).toEqual([])
})

test('v7 kit Slider component uses variant B too', async ({ page }) => {
  const errs = await open(page, '#/feature/editor-chrome-toolbar')
  const r = await componentSliders(page)
  expect(r.n).toBeGreaterThanOrEqual(3)
  expect(r.ok).toBe(true)
  expect(errs).toEqual([])
})

test('v8 §3.3 sliders: arrows ±1 step, Shift ×10, double-click resets, value field editable', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  const sl = D(page, '[data-reset]').first()
  const step = await stepOf(sl)
  const v0 = await valueOf(sl)
  await sl.hover()
  const y0 = await page.evaluate(() => scrollY)
  await page.keyboard.press('ArrowRight')
  await expectNear(sl, v0 + step, step)
  await page.keyboard.press('Shift+ArrowRight')
  await expectNear(sl, v0 + 11 * step, step)
  await page.keyboard.press('ArrowLeft')
  await expectNear(sl, v0 + 10 * step, step)
  await sl.dblclick()
  await expectNear(sl, +((await sl.getAttribute('data-reset')) ?? NaN), step)
  expect(
    await D(page, '[data-testid="slider-value"]').first().isEditable(),
  ).toBe(true)
  expect(await page.evaluate(() => scrollY)).toBe(y0)
  expect(errs).toEqual([])
})

test('v8.1 P2-3 slider double-click resets to the real default (frame style, spread margin/gap, compare, pages)', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await D(page, '[data-item="p3"]').click()
  const sp = D(page, '[data-testid="spread-spacing"] [data-reset]')
  for (let i = 0; i < 2; i++) {
    const [d, v1, v2] = await dbl(page, sp.nth(i))
    const label = `spread${String(i)}`
    expect(d, label).toBe(0)
    expect(v1, label).not.toBe(d)
    expect(v2, label).toBe(d)
  }
  expect(errs).toEqual([])
})

test('v8.1 P2-3 every listed slider declares its real default (resetValue)', () => {
  const read = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8')
  const rows: [string, RegExp][] = [
    ['sandbox/sections.tsx', /<SliderRow label="Mat"[^>]*/],
    ['sandbox/sections.tsx', /<SliderRow label="Stroke"[^>]*/],
    ['sandbox/sections.tsx', /<SliderRow label="Corner radius"[^>]*/],
    ['sandbox/context-inspector.tsx', /<SliderRow label="Margin"[^>]*/],
    ['sandbox/context-inspector.tsx', /<SliderRow label="Gap"[^>]*/],
  ]
  const bad = rows
    .filter(
      ([f, re]) => !(read(f).match(re)?.[0] ?? '').includes('resetValue='),
    )
    .map(([f, re]) => `${f}:${re.source}`)
  expect(bad).toEqual([])
})
