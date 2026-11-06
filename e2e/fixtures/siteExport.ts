import { expect, type Page } from '@playwright/test'

// Designer spec static-export Tests: the `?fixture=painter` editor exports
// into an OPFS folder that stands in for the `showDirectoryPicker` folder.
// Its photos have no `contentHash`, like a folder import: Export hashes them.
export const FIXTURE = '/?fixture=painter'

export const pill = (page: Page) => page.getByTestId('export-site')
export const dialog = (page: Page) => page.getByTestId('export-site-dialog')

export async function openFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
}

/** `showDirectoryPicker` double → a fresh OPFS folder (`dist/notes.txt` when foreign). */
export async function useOpfsFolder(
  page: Page,
  name: string,
  foreign = false,
): Promise<void> {
  await page.evaluate(
    async ({ name, foreign }) => {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(name, { recursive: true }).catch(() => undefined)
      const folder = await root.getDirectoryHandle(name, { create: true })
      if (foreign) {
        const dist = await folder.getDirectoryHandle('dist', { create: true })
        const file = await dist.getFileHandle('notes.txt', { create: true })
        const writable = await file.createWritable()
        await writable.write('mine')
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(folder),
      })
    },
    { name, foreign },
  )
}

/** Open Options with a folder (picked when asked). */
export async function openOptions(page: Page, pick: boolean): Promise<void> {
  await pill(page).click()
  await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
  if (pick) {
    await page.getByTestId('export-site-choose').click()
  }
  await expect(page.getByTestId('export-site-folder')).toBeVisible()
}

/** Options → (pick when asked) → Export. */
export async function startExport(page: Page, pick: boolean): Promise<void> {
  await openOptions(page, pick)
  await page.getByTestId('export-site-go').click()
}

/** Export and stay in the dialog until it shows Done, then close it. */
export async function exportToDone(page: Page, pick: boolean): Promise<void> {
  await startExport(page, pick)
  await expect(dialog(page)).toHaveAttribute('data-step', 'done', {
    timeout: 30_000,
  })
  await page.getByTestId('export-site-close').click()
  await expect(dialog(page)).toHaveCount(0)
}
