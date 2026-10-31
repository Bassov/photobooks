import { expect, type Page } from '@playwright/test'

export interface TrimMm {
  widthMm: number
  heightMm: number
}

/** Kit #/demo reference book: "Lake trip", 19 × 23 cm pages. */
export const LAKE_TRIP_TRIM: TrimMm = { widthMm: 190, heightMm: 230 }

/** Cold start → in-memory library → new book with `trim` open in the editor (saved). */
export async function openLibraryBook(
  page: Page,
  title = 'Lake trip',
  trim: TrimMm = LAKE_TRIP_TRIM,
): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(
    async ({ title, trim }) => {
      const api = window.__photobooksProject
      if (!api) {
        throw new Error('missing api')
      }
      const attached = await api.attachMemoryLibraryForTests()
      if (!attached.ok) {
        throw new Error(attached.code ?? 'attach')
      }
      const created = await api.createBookInLibrary(title, { trim })
      if (!created.ok) {
        throw new Error(created.code ?? 'create')
      }
    },
    { title, trim },
  )
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
}
