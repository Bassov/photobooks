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
