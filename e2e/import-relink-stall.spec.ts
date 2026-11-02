import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  installPhotoDirectoryPickerStub,
  queuePhotoDirectoryPicker,
  type StubPhotoFile,
} from './fixtures/photoDirectoryPicker'

const COUNT = 21

declare global {
  interface Window {
    __pbFailRootPersist?: boolean
    __pbRelinkDialogSeen?: boolean
    __pbStatusesSeen?: string[]
  }
}

test('folder import lands every photo when the folder binding cannot be saved', async ({
  page,
}) => {
  test.setTimeout(90_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const base64 = readFileSync(photoFixturePaths.samplePng).toString('base64')
  const files: StubPhotoFile[] = Array.from({ length: COUNT }, (_, i) => ({
    name: `photo-${String(i + 1).padStart(2, '0')}.png`,
    mime: 'image/png',
    base64,
  }))
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  await installPhotoDirectoryPickerStub(page)
  // Prod picker doubles (and full or blocked storage) make the photo-root
  // IDB writes throw, as Chromium does for a handle it cannot clone.
  await page.addInitScript(() => {
    const realPut = Reflect.get(IDBObjectStore.prototype, 'put') as (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) => IDBRequest<IDBValidKey>
    IDBObjectStore.prototype.put = function put(
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ): IDBRequest<IDBValidKey> {
      const rootStore =
        this.name === 'book-photo-roots' || this.name === 'source-root-handles'
      if (window.__pbFailRootPersist === true && rootStore) {
        throw new DOMException('could not be cloned', 'DataCloneError')
      }
      return realPut.apply(this, args)
    }
  })
  await page.goto('/?testLibrary=1')
  await createBookViaLibrary(page)
  await page.evaluate(() => {
    window.__pbFailRootPersist = true
    window.__pbRelinkDialogSeen = false
    window.__pbStatusesSeen = []
    const seen = (): void => {
      if (document.querySelector('[data-testid="relink-dialog"]') !== null) {
        window.__pbRelinkDialogSeen = true
      }
      // Autosave replaces the status line soon after; keep every value.
      const status = document
        .querySelector('[data-testid="editor-status"]')
        ?.textContent.trim()
      if (status && window.__pbStatusesSeen?.at(-1) !== status) {
        window.__pbStatusesSeen?.push(status)
      }
    }
    new MutationObserver(seen).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })

  await queuePhotoDirectoryPicker(page, files)
  await page.getByTestId('film-add-folder').click()

  const filmstrip = page.getByTestId('filmstrip')
  await expect(filmstrip).toHaveAttribute('data-gallery-count', String(COUNT), {
    timeout: 30_000,
  })
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 30_000,
  })
  await expect
    .poll(() => page.evaluate(() => window.__pbStatusesSeen ?? []))
    .toContain(
      'Photos added; the folder will need to be added again after reload',
    )
  await expect(filmstrip).toHaveAttribute('data-gallery-count', String(COUNT))
  // Every gallery asset has a live session File (none left as a placeholder).
  const missing = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __photobooksRelink?: {
          detectMissingAssets: (o: { openDialog: boolean }) => {
            missing: number
          }
        }
      }
    ).__photobooksRelink
    return api?.detectMissingAssets({ openDialog: false }).missing
  })
  expect(missing).toBe(0)
  expect(await page.evaluate(() => window.__pbRelinkDialogSeen)).toBe(false)
  await expect(page.getByTestId('relink-dialog')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
