import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// design-r47 M158 (Designer parity cycle-layouts p2, 2026-11-22): the light
// top-bar tooltips (Select, Zoom out, …) match the kit chrome tooltip
// (uikit/src/sandbox/chrome.tsx): box 26.8 high, line-height 16.8, no inset
// ring, 4 px below the button, opens after 300 ms. Before: 25.59, 15.6, an
// inset 1px ring, 6 px, 400 ms.

test.use({ viewport: { width: 1440, height: 900 } })

async function openSpreadOne(page: Page): Promise<void> {
  await openLibraryBook(page)
  await page
    .getByTestId(/^spread-list-item-/)
    .nth(1)
    .click()
  await page.mouse.move(1439, 899)
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')
}

/** ms from the pointer entering `testId` to the tooltip appearing, plus its geometry */
async function hoverTip(page: Page, testId: string) {
  const button = page.getByTestId(testId)
  const b = await button.boundingBox()
  if (!b) throw new Error('no button')
  // past RAC's 500 ms warm-up cool-down, so this hover waits the full delay
  await page.mouse.move(1439, 899)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.evaluate(() => new Promise((r) => setTimeout(r, 700)))
  await button.evaluate((el) => {
    const w = window as unknown as { __tip?: { enter: number; open: number } }
    w.__tip = { enter: 0, open: 0 }
    el.addEventListener(
      'pointerenter',
      () => {
        if (w.__tip) w.__tip.enter = performance.now()
      },
      { once: true },
    )
    const mo = new MutationObserver(() => {
      if (w.__tip && document.querySelector('[role=tooltip]')) {
        w.__tip.open = performance.now()
        mo.disconnect()
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
  })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const box = tip.locator('.pb-tooltip__box')
  const t = await box.boundingBox()
  if (!t) throw new Error('no tooltip box')
  const look = await box.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { lineHeight: parseFloat(cs.lineHeight), shadow: cs.boxShadow }
  })
  const ms = await page.evaluate(() => {
    const w = window as unknown as { __tip: { enter: number; open: number } }
    return w.__tip.open - w.__tip.enter
  })
  return { b, t, look, ms, box }
}

for (const testId of ['tool-select', 'zoom-out']) {
  test(`design-r47 M158: ${testId} tooltip is 26.8 high, 4 px below, no ring, opens after 300 ms`, async ({
    page,
  }) => {
    await openSpreadOne(page)
    const { b, t, look, ms, box } = await hoverTip(page, testId)
    expect(Math.abs(t.height - 26.8)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(look.lineHeight - 16.8)).toBeLessThanOrEqual(0.2)
    expect(look.shadow).not.toContain('inset')
    expect(Math.abs(t.y - (b.y + b.height + 4))).toBeLessThanOrEqual(0.5)
    // hidden at 250 ms, shown by 450 ms after the pointer came in
    expect(ms).toBeGreaterThan(250)
    expect(ms).toBeLessThan(450)
    await expect(box).toHaveText(/\S/)
  })
}
