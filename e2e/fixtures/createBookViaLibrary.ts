import { expect, type Page } from '@playwright/test'

/** New book from the editor: Library → New book dialog → editor (header has no New book). */
export async function createBookViaLibrary(
  page: Page,
  title = 'Test book',
): Promise<void> {
  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('new-book').click()
  await page.getByTestId('create-title').fill(title)
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
}
