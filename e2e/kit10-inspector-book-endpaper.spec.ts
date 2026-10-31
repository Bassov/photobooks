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
  // Kit v7.tsx:202: back text, else front title, else "Untitled book".
  await expect(settings.getByTestId('book-settings-subtitle')).toHaveText(
    'Untitled book · applies to the whole book',
  )
  const eyebrow = settings.locator('.inspector-eyebrow').first()
  await expect(eyebrow).toHaveCSS('text-transform', 'uppercase')
  await expect(eyebrow).toHaveCSS('color', MUTED)
  for (const label of ['Page size', 'Print', 'Pages', 'Paper']) {
    await expect(settings.getByText(label, { exact: true })).toBeVisible()
  }
  // Kit book settings have no Layout grid section (uikit/src/sandbox/v7.tsx:202-210).
  await expect(page.getByTestId('grid-section-book')).toHaveCount(0)
  // Endpaper rows now show: uikit/src/sandbox/chrome.tsx:275,278 (bk.endp);
  // coverage moved to e2e/design-inspector-book-cover.spec.ts.
  await assertDocumentFitsViewport(page)
})
