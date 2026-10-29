import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { applyLayout, layoutTile } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('portrait and contact-sheet templates apply and switch back', async ({
  page,
}) => {
  await openSessionEditor(page)
  const frames = page
    .getByTestId('spread-view')
    .first()
    .getByTestId('spread-frame-placeholder')

  await applyLayout(page, '2 portraits')
  const twoPortraits = layoutTile(page, '2 portraits')
  await expect(frames).toHaveCount(2)

  await page.getByTestId('layout-contact-cols').fill('3')
  await page.getByTestId('layout-contact-rows').fill('4')
  await page.getByTestId('layout-contact-apply').click()
  await expect(frames).toHaveCount(12)
  await expect(twoPortraits).toHaveAttribute('aria-pressed', 'false')

  // The inspector clamps out-of-range counts instead of disabling Apply.
  await page.getByTestId('layout-contact-cols').fill('9')
  await page.getByTestId('layout-contact-cols').press('Tab')
  await expect(page.getByTestId('layout-contact-cols')).toHaveValue('5')

  await applyLayout(page, '2-up')
  await expect(frames).toHaveCount(2)
  await assertDocumentFitsViewport(page)
})
