import { expect, test } from './fixtures/coverage'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('the spread row menu duplicates a spread and lists the bound shortcuts', async ({
  page,
}) => {
  await openSessionEditor(page)
  const rows = page.locator('[data-testid^="spread-list-item-"]')
  await expect(rows).toHaveCount(3)

  await rows.nth(1).hover()
  await page.getByRole('button', { name: 'Pages 2–3 actions' }).click()
  await expect(page.getByTestId('spread-menu-add')).toContainText('Ctrl+↵')
  await expect(page.getByTestId('spread-menu-duplicate')).toContainText(
    'Ctrl+D',
  )
  await expect(page.getByTestId('spread-menu-delete')).toContainText('Del')
  await expect(
    page
      .getByRole('menu', { name: 'Pages 2–3 actions' })
      .getByRole('separator'),
  ).toHaveCount(1)

  await page.getByTestId('spread-menu-duplicate').click()
  await expect(rows).toHaveCount(4)
})

test('a status message shows as a visible pill over the canvas', async ({
  page,
}) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Status book')
  })
  await createBookViaLibrary(page)
  const pill = page.getByTestId('editor-status')
  await expect(pill).toHaveText('Book created')
  await expect(pill).toBeVisible()
  await expect(
    page.getByTestId('editor-workspace').getByTestId('editor-status'),
  ).toHaveCount(1)
  await expect(page.getByTestId('template-add-spread')).toHaveCount(0)
})
