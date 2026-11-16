import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import { openPrintFixture } from './fixtures/printJob'

// design-r30-print-checkbox (Designer pdf-export PE9, M121): the Print
// dialog's bleed checkbox is the shared ui/Checkbox and paints like the kit
// Checkbox: `bg-mark` fill, a 16 px tick at the box corner, a 13 px / 500
// label with line-height 13 px.

test.use({ viewport: { width: 1440, height: 900 }, channel: 'chromium' })

const input = (page: Page) => page.getByTestId('print-bleed')
const label = (page: Page) => input(page).locator('xpath=..')
const box = (page: Page) => label(page).locator('.pb-check__box')

const folderFor = (testInfo: TestInfo) =>
  `print-r30-${String(testInfo.workerIndex)}-${String(Date.now())}`

async function openPrint(page: Page, testInfo: TestInfo) {
  await openPrintFixture(page, folderFor(testInfo))
  await page.getByTestId('print').click()
  await expect(page.getByTestId('print-dialog')).toHaveAttribute(
    'data-step',
    'opts',
  )
}

async function rect(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('expected a bounding box')
  return b
}

function near(rgb: number[] | undefined, want: number, tol = 2) {
  const [r = -1, g = -1, b = -1] = rgb ?? []
  for (const c of [r, g, b]) expect(Math.abs(c - want)).toBeLessThanOrEqual(tol)
}

test('the checked bleed box fills with the kit mark and a corner 16 px tick', async ({
  page,
}, testInfo) => {
  await openPrint(page, testInfo)
  await expect(input(page)).toBeChecked()

  // Off the tick: the mark fill; on the tick's long stroke: the light ink.
  const [top, bottom, stroke] = await pixelsAt(box(page), [
    { x: 8, y: 2 },
    { x: 13, y: 13 },
    // Pixel (9, 7): its centre lies on the M20 6 9 17 stroke.
    { x: 9, y: 7 },
  ])
  near(top, 142)
  near(bottom, 142)
  expect(stroke?.[0] ?? 0).toBeGreaterThan(200)

  const b = await rect(box(page))
  const tick = await rect(box(page).locator('svg[data-icon="check"]'))
  expect(Math.abs(tick.width - 16)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(tick.height - 16)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(tick.x - b.x)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(tick.y - b.y)).toBeLessThanOrEqual(0.5)
})

test('the bleed label is 13 px / 500 with line-height 13 px', async ({
  page,
}, testInfo) => {
  await openPrint(page, testInfo)
  const type = await label(page).evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.fontSize, s.fontWeight, s.lineHeight]
  })
  expect(type).toEqual(['13px', '500', '13px'])
})

test('unchecked colour, radius 6 and the focus ring stay as they were', async ({
  page,
}, testInfo) => {
  await openPrint(page, testInfo)
  await label(page)
    .getByText(/bleed and crop marks$/)
    .click()
  await expect(input(page)).not.toBeChecked()
  await expect(box(page).locator('svg')).toHaveCount(0)

  const [centre] = await pixelsAt(box(page), [{ x: 8, y: 8 }])
  near(centre, 202)
  expect(
    await box(page).evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe('6px')

  // Keyboard focus (Shift+Tab, Tab) shows the 2 px ring at 2 px offset.
  await input(page).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(input(page)).toBeFocused()
  const ring = await box(page).evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.outlineStyle, s.outlineWidth, s.outlineOffset]
  })
  expect(ring).toEqual(['solid', '2px', '2px'])
})
