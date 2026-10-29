import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { openSessionEditor } from './fixtures/openSessionEditor'
import type { Page } from '@playwright/test'

/** Ruler origins (strip start + mm 0 offset) must sit on the active spread's top-left. */
async function expectAligned(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const spread = await page
        .locator('[data-active="true"] [data-testid="spread-view"]')
        .boundingBox()
      const rx = await page.getByTestId('ruler-x').boundingBox()
      const ry = await page.getByTestId('ruler-y').boundingBox()
      const ox = Number(
        await page.getByTestId('ruler-x').getAttribute('data-origin'),
      )
      const oy = Number(
        await page.getByTestId('ruler-y').getAttribute('data-origin'),
      )
      if (!spread || !rx || !ry) return Infinity
      return Math.max(
        Math.abs(rx.x + ox - spread.x),
        Math.abs(ry.y + oy - spread.y),
      )
    })
    .toBeLessThan(1.5)
}

test('rulers are off by default; the Rulers toggle and Shift+R show / hide them', async ({
  page,
}) => {
  await openSessionEditor(page)
  const toggle = page.getByRole('button', { name: /^Rulers/ })
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)
  await expect(page.getByTestId('ruler-y')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await expect(page.getByTestId('ruler-y')).toBeVisible()
  await expect(page.getByTestId('ruler-corner')).toHaveText('mm')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const x = await page.getByTestId('ruler-x').boundingBox()
  expect(Math.round(x?.height ?? 0)).toBe(22)
  const y = await page.getByTestId('ruler-y').boundingBox()
  expect(Math.round(y?.width ?? 0)).toBe(22)

  await toggle.click()
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)

  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)
  await expect(page.getByTestId('ruler-y')).toHaveCount(0)
})

test('rulers follow the active spread through scroll and zoom; the page never scrolls', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await assertDocumentFitsViewport(page)
  await expectAligned(page)

  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    el.scrollTop = 120
  })
  await expectAligned(page)
  await dispatchCtrlWheel(page, -120, 3)
  await expectAligned(page)

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
  await expectAligned(page)
})

test('the cursor tick follows the pointer over the pasteboard and clears on leave', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.keyboard.press('Shift+R')
  const scroll = await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const { x, y } = el.getBoundingClientRect()
    return { x, y }
  })
  const tick = page.locator('.ruler-cursor-x')
  await expect(tick).toBeHidden()
  await page.mouse.move(scroll.x + 80, scroll.y + 60)
  await expect(tick).toBeVisible()
  const left = await tick.evaluate((el) => (el as HTMLElement).style.left)
  expect(Number.parseFloat(left)).toBeCloseTo(80, 0)
  await page.mouse.move(2, 2)
  await expect(tick).toBeHidden()
})
