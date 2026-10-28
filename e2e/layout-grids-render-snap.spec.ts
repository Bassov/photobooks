import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test("TopBar toggle and Ctrl+' show / hide the dashed grid overlay", async ({
  page,
}) => {
  await openSessionEditor(page)
  const toggle = page.getByTestId('grid-topbar-toggle')
  await expect(page.getByTestId('grid-overlay')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const overlay = page.getByTestId('grid-overlay').first()
  await expect(overlay).toBeVisible()
  await expect(
    page.getByTestId('grid-overlay-content').first(),
  ).toHaveAttribute('stroke-dasharray', /.+/)
  // Default grid is 2×2 per page; every page carries both bands.
  const pages = await page.getByTestId('grid-overlay-page').count()
  await expect(page.getByTestId('grid-overlay-column')).toHaveCount(2 * pages)
  await expect(page.getByTestId('grid-overlay-row')).toHaveCount(2 * pages)
  expect(
    await overlay.evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe('none')
  await assertDocumentFitsViewport(page)

  await page.keyboard.press("Control+'")
  await expect(page.getByTestId('grid-overlay')).toHaveCount(0)
  await page.keyboard.press("Control+'")
  await expect(page.getByTestId('grid-overlay').first()).toBeVisible()
})
