import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// inspector-empty-after-grey: with nothing selected the inspector shows the
// active spread's Spread context (kit ContextInspector), whatever path set
// the selection — Esc, list rows, grey presses and Hand pans never leave
// the empty hint behind.

/** Painter fixture rows: "1", "2–3", "4–5", … */
const rows = (page: Page) => page.locator('[data-testid^="spread-list-item-"]')
const spreadView = (page: Page, index: number) =>
  page.locator(
    `[data-testid="spread-view"][data-spread-id="painter-spread-${String(index)}"]`,
  )
const title = (page: Page) => page.getByTestId('inspector-context')
const summary = (page: Page) => page.getByTestId('inspector-spread-summary')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return box
}

async function expectSpread(page: Page, pages: RegExp): Promise<void> {
  await expect(page.getByTestId('inspector-panel')).toHaveAttribute(
    'data-inspector-view',
    'spread',
  )
  await expect(title(page)).toHaveText('Spread')
  await expect(summary(page)).toHaveText(pages)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=painter')
  await expect(rows(page).first()).toBeVisible()
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await expectSpread(page, /^Page 1 · /)
})

test('repro 1: Esc ×2, grey press on page 1, then list row 2–3 → Spread · Pages 2–3', async ({
  page,
}) => {
  await rows(page).nth(1).click()
  await spreadView(page, 1).getByTestId('spread-frame').first().click()
  await expect(title(page)).toHaveText('Photo')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expectSpread(page, /^Pages 2–3 · /)

  const board = await boxOf(page.getByTestId('pasteboard'))
  await page.mouse.click(board.x + 20, board.y + 20)
  await expect(rows(page).nth(0)).toHaveAttribute('aria-selected', 'true')
  await expectSpread(page, /^Page 1 · /)

  await rows(page).nth(1).click()
  await expect(rows(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expectSpread(page, /^Pages 2–3 · /)
})

test('repro 2: crop a photo, Esc ×2 → Spread of that spread', async ({
  page,
}) => {
  await spreadView(page, 0)
    .locator('[data-testid="spread-frame"][data-filled="true"]')
    .first()
    .dblclick()
  await expect(
    page.locator('[data-testid="spread-frame"][data-crop-active="true"]'),
  ).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(
    page.locator('[data-testid="spread-frame"][data-crop-active="true"]'),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expectSpread(page, /^Page 1 · /)
})

test('repro 3: Esc with nothing selected, then the page-1 row → Spread · Page 1', async ({
  page,
}) => {
  await page.keyboard.press('Escape')
  await expectSpread(page, /^Page 1 · /)
  await rows(page).nth(0).click()
  await expectSpread(page, /^Page 1 · /)
})

test('Hand: frame selected, Esc, short Hand drag → Spread (kit keeps the spread context)', async ({
  page,
}) => {
  await spreadView(page, 0).getByTestId('spread-frame').first().click()
  await expect(title(page)).toHaveText('Photo')
  await page.keyboard.press('Escape')
  await page.keyboard.press('h')
  const box = await boxOf(spreadView(page, 0))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(page.getByTestId('inspector-panel')).toHaveAttribute(
    'data-inspector-view',
    'spread',
  )
  await expect(title(page)).toHaveText('Spread')
})
