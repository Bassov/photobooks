import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

const rows = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid^="spread-list-item-"]')

async function boxOf(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return box
}

test('spreads panel lists thumbnails, navigates, and manages spreads', async ({
  page,
}) => {
  await openSessionEditor(page)
  const list = page.getByTestId('spreads-list')
  await expect(rows(page)).toHaveCount(3)
  await expect(list.locator('.spread-view--thumb')).toHaveCount(3)
  // Thumbnails are inert and never match pasteboard selectors.
  await expect(
    page.getByTestId('pasteboard-scroll').getByTestId('spread-view').first(),
  ).toBeVisible()

  // Click scrolls the pasteboard to that spread.
  await rows(page).nth(2).click()
  await expect(rows(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.locator('[data-pasteboard-slot][data-active="true"]'),
  ).toHaveAttribute('data-slot-index', '2')

  // Duplicate, then delete with Undo from the keyboard.
  await rows(page).nth(0).click()
  await rows(page).nth(0).press('Control+d')
  await expect(rows(page)).toHaveCount(4)
  await expect(rows(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await rows(page).nth(1).press('Delete')
  await expect(rows(page)).toHaveCount(3)
  await page.getByTestId('spread-deleted-toast').getByText('Undo').click()
  await expect(rows(page)).toHaveCount(4)

  // Menu: add after the first spread.
  await page
    .getByTestId(/^spread-menu-/)
    .first()
    .click()
  await page.getByTestId('spread-menu-add').click()
  await expect(rows(page)).toHaveCount(5)

  await assertDocumentFitsViewport(page)
})

test('long list is windowed, scrolls inside spreads-list and navigates far', async ({
  page,
}) => {
  await openSessionEditor(page)
  const add = page.getByTestId('add-spread')
  for (let i = 0; i < 37; i += 1) {
    await add.click()
  }
  await expect(rows(page).first()).toBeVisible()
  const mounted = await rows(page).count()
  expect(mounted).toBeGreaterThan(0)
  expect(mounted).toBeLessThan(40)

  await assertNamedScrollport(page, 'spreads-list', {
    axis: 'vertical',
    nudgeHorizontal: true,
  })
  await assertDocumentFitsViewport(page)

  // Jump the list to the middle: the window slides, first row unmounts.
  await page
    .getByTestId('spreads-list')
    .evaluate((el) => (el.scrollTop = el.scrollHeight / 2))
  await expect(page.getByTestId('spread-list-item-spread-1')).toHaveCount(0)
  await assertDocumentFitsViewport(page)

  // Clicking a far row reveals that spread on the pasteboard. A late active
  // spread change (add-spread reveal) may still re-window the list, so read
  // and click the row as one retried step.
  await expect(async () => {
    const id = (await rows(page).last().getAttribute('data-item')) ?? ''
    const far = page.getByTestId(`spread-list-item-${id}`)
    await far.click({ timeout: 2000 })
    await expect(far).toHaveAttribute('aria-selected', 'true', {
      timeout: 2000,
    })
    await expect(
      page.locator(`[data-pasteboard-slot][data-spread-id="${id}"]`),
    ).toHaveAttribute('data-active', 'true', { timeout: 2000 })
  }).toPass({ timeout: 20_000 })
})

test('a two-page spread thumbnail fills the card width at the spread aspect', async ({
  page,
}) => {
  await openSessionEditor(page)
  const row = rows(page).nth(1)
  const card = await boxOf(row)
  const thumb = await boxOf(row.locator('.spread-view--thumb'))
  const spread = await boxOf(page.getByTestId('spread-view').nth(1))
  // The card carries p-2 (8px) on both sides.
  expect(thumb.width).toBeGreaterThanOrEqual(card.width - 16 - 1)
  expect(thumb.width / thumb.height).toBeCloseTo(
    spread.width / spread.height,
    1,
  )
})

test('last spread cannot be deleted', async ({ page }) => {
  await openSessionEditor(page)
  for (let i = 0; i < 2; i += 1) {
    await rows(page).nth(0).click()
    await rows(page).nth(0).press('Delete')
  }
  await expect(rows(page)).toHaveCount(1)
  await rows(page).nth(0).press('Delete')
  await expect(rows(page)).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})
