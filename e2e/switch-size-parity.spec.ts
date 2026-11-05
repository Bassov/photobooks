import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { expectKitSwitchSm } from './fixtures/switchGeometry'

// switch-size-parity (Designer note on #491): the prod inspector switch
// (`ToggleSwitch`, `.insp-toggle`) is the kit `Switch size="sm"`: 36×20 track,
// 16 px knob at +2 off / +18 on. Every prod role=switch is that component.

// Book settings `.inspector-row` heights before the 36×20 switch (32×18):
// the bigger track must not grow any row.
const ROW_HEIGHTS = [26.84, 18.84, 26.84, 26.84, 18.84, 26.84, 26.84, 18.84]

async function openBookSettings(page: Page) {
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await page.getByTestId('book-title').click()
  await expect(page.getByTestId('book-settings')).toBeVisible()
}

const knobOf = (page: Page, testId: string) =>
  page.getByTestId(testId).locator('.insp-toggle-knob')

test.beforeEach(async ({ page }) => {
  await openBookSettings(page)
})

test('inspector switches match the kit Switch sm off and on', async ({
  page,
}) => {
  const endpapers = page.getByTestId('book-endpapers')
  const skipFirst = page.getByTestId('book-pn-skip-first')
  await expect(endpapers).toHaveAttribute('aria-checked', 'true')
  await expect(skipFirst).toHaveAttribute('aria-checked', 'false')
  await expectKitSwitchSm(endpapers, knobOf(page, 'book-endpapers'), true)
  await expectKitSwitchSm(skipFirst, knobOf(page, 'book-pn-skip-first'), false)

  await skipFirst.click()
  await expect(skipFirst).toHaveAttribute('aria-checked', 'true')
  await expectKitSwitchSm(skipFirst, knobOf(page, 'book-pn-skip-first'), true)
  await endpapers.click()
  await expect(endpapers).toHaveAttribute('aria-checked', 'false')
  await expectKitSwitchSm(endpapers, knobOf(page, 'book-endpapers'), false)
})

test('the bigger switch leaves Book settings row heights as they were', async ({
  page,
}) => {
  const heights = await page
    .getByTestId('book-settings')
    .locator('.inspector-row')
    .evaluateAll((rows) =>
      rows.map((r) => Math.round(r.getBoundingClientRect().height * 100) / 100),
    )
  expect(heights).toEqual(ROW_HEIGHTS)
})
