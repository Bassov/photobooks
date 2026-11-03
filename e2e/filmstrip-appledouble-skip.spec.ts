import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

interface OpfsFile {
  path: string
  base64: string
}

/** macOS AppleDouble header (magic 0x00051607) padded like a real `._` file. */
function appleDoubleBase64(): string {
  const bytes = Buffer.alloc(4096)
  Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]).copy(bytes)
  bytes.write('Mac OS X        ', 8, 'ascii')
  return bytes.toString('base64')
}

/** SOI + APP0 fragment: typed as JPEG by extension, fails decode. */
const CORRUPT_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]).toString('base64')

function jpegBase64(): string {
  return readFileSync(photoFixturePaths.sampleOrient6).toString('base64')
}

/**
 * Write files into a real OPFS directory and point `showDirectoryPicker` at
 * it: unlike the picker double, its handle survives IDB structured clone, so
 * reload restores folder access. Re-run after reload to re-add the folder.
 */
async function stubOpfsPhotoFolder(
  page: Page,
  folder: string,
  files: readonly OpfsFile[],
): Promise<void> {
  await page.evaluate(
    async ({ folderName, entries }) => {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle(folderName, { create: true })
      for (const entry of entries) {
        const segments = entry.path.split('/')
        const fileName = segments.pop() ?? entry.path
        let parent = dir
        for (const segment of segments) {
          parent = await parent.getDirectoryHandle(segment, { create: true })
        }
        const handle = await parent.getFileHandle(fileName, { create: true })
        const writable = await handle.createWritable()
        const binary = atob(entry.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }
        await writable.write(bytes)
        await writable.close()
      }
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: () => Promise.resolve(dir),
      })
    },
    { folderName: folder, entries: files },
  )
}

interface TileCensus {
  tiles: number
  /** Tiles without a decoded thumb image (gray / blank). */
  gray: number
  titles: string[]
}

async function tileCensus(page: Page): Promise<TileCensus> {
  const tiles = await page.getByTestId('filmstrip-item').evaluateAll((items) =>
    items.map((item) => {
      const img = item.querySelector<HTMLImageElement>(
        '[data-testid="filmstrip-thumb"]',
      )
      return {
        title:
          item.querySelector('.filmstrip-drag')?.getAttribute('title') ?? '',
        decoded: img !== null && img.complete && img.naturalWidth > 0,
      }
    }),
  )
  return {
    tiles: tiles.length,
    gray: tiles.filter((tile) => !tile.decoded).length,
    // After reload a title may fall back to the `asset-N-<name>` id.
    titles: tiles.map((tile) => tile.title.replace(/^asset-\d+-/, '')).sort(),
  }
}

async function importErrorNames(page: Page): Promise<string[]> {
  const button = page.getByTestId('import-errors')
  if ((await button.count()) === 0) {
    return []
  }
  await button.click()
  const panel = page.getByTestId('import-errors-panel')
  await expect(panel).toBeVisible()
  const names = await panel.getByTestId('import-error-entry').allTextContents()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  return names.sort()
}

async function openLibraryBook(page: Page, title: string): Promise<void> {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept(title)
  })
  await createBookViaLibrary(page)
}

async function settleImport(page: Page, galleryCount: number): Promise<void> {
  await expect(page.getByTestId('filmstrip')).toHaveAttribute(
    'data-gallery-count',
    String(galleryCount),
    { timeout: 60_000 },
  )
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })
}

async function saveAndReload(page: Page): Promise<void> {
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 30_000,
  })
}

const REAL_TITLES = ['DSCF0001.JPG', 'DSCF0002.JPG', 'DSCF0003.JPG']

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('AppleDouble, .DS_Store and hidden-folder files never become tiles or errors', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const jpeg = jpegBase64()
  const appleDouble = appleDoubleBase64()
  const files: OpfsFile[] = [
    ...REAL_TITLES.map((path) => ({ path, base64: jpeg })),
    { path: '._DSCF0001.JPG', base64: appleDouble },
    { path: '._DSCF0002.JPG', base64: appleDouble },
    { path: 'trip/._DSCF0004.jpg', base64: appleDouble },
    { path: '.DS_Store', base64: appleDouble },
    { path: '.Trashes/DSCF0009.JPG', base64: jpeg },
  ]
  await openLibraryBook(page, 'AppleDouble skip')
  await stubOpfsPhotoFolder(page, 'appledouble-photos', files)
  await page.getByTestId('film-add-folder').click()
  await settleImport(page, REAL_TITLES.length)

  const expected = { tiles: 3, gray: 0, titles: REAL_TITLES }
  await expect.poll(() => tileCensus(page)).toEqual(expected)
  expect(await importErrorNames(page)).toEqual([])

  for (let reload = 0; reload < 2; reload += 1) {
    await saveAndReload(page)
    await settleImport(page, REAL_TITLES.length)
    await expect
      .poll(() => tileCensus(page), { timeout: 30_000 })
      .toEqual(expected)
    expect(await importErrorNames(page)).toEqual([])
  }

  // Re-add the same folder: nothing new, no errors.
  await stubOpfsPhotoFolder(page, 'appledouble-photos', files)
  await page.getByTestId('film-add-folder').click()
  await settleImport(page, REAL_TITLES.length)
  await expect.poll(() => tileCensus(page)).toEqual(expected)
  expect(await importErrorNames(page)).toEqual([])
})

test('corrupt JPEG stays an import error after reload, never a gray tile', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const jpeg = jpegBase64()
  const files: OpfsFile[] = [
    { path: 'DSCF0001.JPG', base64: jpeg },
    { path: 'DSCF0002.JPG', base64: jpeg },
    { path: 'broken.jpg', base64: CORRUPT_JPEG_BASE64 },
  ]
  await openLibraryBook(page, 'Corrupt reload')
  await stubOpfsPhotoFolder(page, 'corrupt-photos', files)
  await page.getByTestId('film-add-folder').click()
  await settleImport(page, 2)

  const expected = {
    tiles: 2,
    gray: 0,
    titles: ['DSCF0001.JPG', 'DSCF0002.JPG'],
  }
  await expect.poll(() => tileCensus(page)).toEqual(expected)
  await expect
    .poll(() => importErrorNames(page))
    .toEqual([expect.stringContaining('broken.jpg')])

  for (let reload = 0; reload < 2; reload += 1) {
    await saveAndReload(page)
    await settleImport(page, 2)
    await expect
      .poll(() => tileCensus(page), { timeout: 30_000 })
      .toEqual(expected)
    await expect
      .poll(() => importErrorNames(page), { timeout: 30_000 })
      .toEqual([expect.stringContaining('broken.jpg')])
  }
})
