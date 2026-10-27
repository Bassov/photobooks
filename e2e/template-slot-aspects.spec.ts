import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
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

  const twoPortraits = page.getByRole('radio', {
    name: '2 portraits',
    exact: true,
  })
  await twoPortraits.click()
  await expect(twoPortraits).toBeChecked()
  await expect(frames).toHaveCount(2)

  await page.getByLabel('Columns').fill('3')
  await page.getByLabel('Rows').fill('4')
  await page.getByRole('button', { name: 'Contact sheet' }).click()
  await expect(frames).toHaveCount(12)
  await expect(twoPortraits).not.toBeChecked()

  await page.getByLabel('Columns').fill('9')
  await expect(
    page.getByRole('button', { name: 'Contact sheet' }),
  ).toBeDisabled()

  await page.getByRole('radio', { name: '2-up' }).click()
  await expect(frames).toHaveCount(2)
  await assertDocumentFitsViewport(page)
})
