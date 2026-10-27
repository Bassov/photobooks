import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

const rows = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid^="spread-list-item-"]')

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
