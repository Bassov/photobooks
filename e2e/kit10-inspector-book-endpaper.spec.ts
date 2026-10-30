import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

// uikit/src/index.css: --muted-foreground #535152.
const MUTED = 'rgb(83, 81, 82)'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

test('step 24: Book tab shows kit Book settings head, rows and book grid', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const settings = page.getByTestId('book-settings')
  await expect(settings.getByTestId('inspector-context')).toHaveText(
    'Book settings',
  )
  await expect(settings).toContainText('Applies to the whole book')
  const eyebrow = settings.locator('.inspector-eyebrow')
  await expect(eyebrow).toHaveCSS('text-transform', 'uppercase')
  await expect(eyebrow).toHaveCSS('color', MUTED)
  for (const label of ['Page size', 'Bleed', 'Safe margin', 'Pages']) {
    await expect(settings.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByTestId('grid-section-book')).toBeVisible()
  // Endpapers are not selectable yet (kit10-cover): hidden, not stubbed.
  await expect(page.getByText('Endpaper')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})
