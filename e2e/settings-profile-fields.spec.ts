import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, type Point } from './fixtures/paintProbe'

// Designer printer-presets r21 (M97, M98); the kit is the reference.
const PAINTER = '/?fixture=painter&printProfiles=kit'
const PANEL = [225, 225, 225]
const HOVER = [215, 215, 215]

async function openPrintPresets(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(PAINTER)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-print').click()
  await expect(page.locator('h1')).toHaveText('Print presets')
}

/** Right end of the row: past the label, inside the rounded corners. */
async function rowEnd(row: Locator): Promise<Point> {
  const box = await row.boundingBox()
  if (box === null) throw new Error('not visible')
  return { x: box.width - 8, y: box.height / 2 }
}

test('a non-current settings nav row paints the panel, hover paints the kit grey', async ({
  page,
}) => {
  await openPrintPresets(page)
  const row = page.getByTestId('settings-nav-library')
  await expect(row).not.toHaveAttribute('aria-current', 'page')
  const probe = [await rowEnd(row)]

  const [rest] = await pixelsAt(row, probe)
  expect(rest?.slice(0, 3)).toEqual(PANEL)

  await row.hover()
  await expect(row).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  const [hover] = await pixelsAt(row, probe)
  expect(hover?.slice(0, 3)).toEqual(HOVER)
})

test('every profile editor number value is ui-monospace 13 px', async ({
  page,
}) => {
  await openPrintPresets(page)
  await page.getByTestId('print-new').click()
  const inputs = page
    .getByTestId('print-profile-dialog')
    .locator('input[inputmode="decimal"]')
  // Every field(): sides, bleed, safe, pages ×3, spine ×2, wrap, hinge, ppi ×2.
  await expect(inputs).toHaveCount(13)
  for (const input of await inputs.all()) {
    const font = await input.evaluate((el) => {
      const style = getComputedStyle(el)
      return { family: style.fontFamily, size: style.fontSize }
    })
    expect(font.family).toMatch(/^ui-monospace\b/)
    expect(font.size).toBe('13px')
  }
})
