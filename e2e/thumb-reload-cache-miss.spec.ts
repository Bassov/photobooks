import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

const COUNT = 60

interface OpfsPhoto {
  name: string
  base64: string
}

/** Rewrite the IFD0 Orientation value of the orient-6 fixture (no IFD1 thumb). */
function withOrientation(source: Buffer, orientation: 1 | 6): Buffer {
  const copy = Buffer.from(source)
  const tiff = copy.indexOf(Buffer.from('Exif\0\0', 'ascii')) + 6
  const entries = copy.readUInt16LE(tiff + 8)
  for (let i = 0; i < entries; i += 1) {
    const entry = tiff + 10 + i * 12
    if (copy.readUInt16LE(entry) === 0x0112) {
      copy.writeUInt16LE(orientation, entry + 8)
      return copy
    }
  }
  throw new Error('Orientation tag not found in fixture')
}

/** Even index: EXIF orientation 1 (40×20 landscape); odd: 6 (20×40 portrait). */
function photos(): OpfsPhoto[] {
  const base = readFileSync(photoFixturePaths.sampleOrient6)
  const upright = withOrientation(base, 1).toString('base64')
  const rotated = withOrientation(base, 6).toString('base64')
  return Array.from({ length: COUNT }, (_, i) => ({
    name: `photo-${String(i).padStart(3, '0')}.jpg`,
    base64: i % 2 === 0 ? upright : rotated,
  }))
}

/**
 * Real OPFS directory as the photo folder: unlike the picker double, its
 * handle survives IDB structured clone, so reload restores folder access.
 */
async function pickOpfsPhotoFolder(
  page: Page,
  files: OpfsPhoto[],
): Promise<void> {
  await page.evaluate(async (entries) => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('thumb-reload-photos', {
      create: true,
    })
    for (const entry of entries) {
      const handle = await dir.getFileHandle(entry.name, { create: true })
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
  }, files)
  await page.getByTestId('film-add-folder').click()
}

interface MountedTile {
  /** Photo index from the file name (title may be id-prefixed after reload). */
  index: number
  placeholder: boolean
  width: number
  height: number
}

async function mountedTiles(page: Page): Promise<MountedTile[]> {
  return page.getByTestId('filmstrip-item').evaluateAll((items) =>
    items.map((item) => {
      const title =
        item.querySelector('.filmstrip-drag')?.getAttribute('title') ?? ''
      const img = item.querySelector<HTMLImageElement>(
        '[data-testid="filmstrip-thumb"]',
      )
      return {
        index: Number(/photo-(\d+)\.jpg/.exec(title)?.[1] ?? -1),
        placeholder:
          item.querySelector('[data-testid="filmstrip-placeholder"]') !== null,
        width: img?.complete === true ? img.naturalWidth : 0,
        height: img?.complete === true ? img.naturalHeight : 0,
      }
    }),
  )
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('reload: never-shown JPEG tail tiles decode upright thumbs on scroll', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Thumb reload')
  })
  await createBookViaLibrary(page)

  await pickOpfsPhotoFolder(page, photos())
  const filmstrip = page.getByTestId('filmstrip')
  await expect(filmstrip).toHaveAttribute('data-gallery-count', String(COUNT), {
    timeout: 120_000,
  })
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  })
  // Only the first filmstrip window is ever shown before save.
  const firstWindow = new Set(
    (await mountedTiles(page)).map((tile) => tile.index),
  )
  expect(firstWindow.has(-1)).toBe(false)
  expect(firstWindow.size).toBeGreaterThan(0)
  expect(firstWindow.size).toBeLessThan(COUNT / 2)

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 60_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 30_000,
  })
  await expect(filmstrip).toHaveAttribute('data-gallery-count', String(COUNT), {
    timeout: 30_000,
  })

  const scroll = page.getByTestId('filmstrip-scroll')
  await scroll.evaluate((node) => {
    node.scrollLeft = node.scrollWidth
  })

  await expect
    .poll(
      async () => {
        const tiles = await mountedTiles(page)
        return {
          mounted: tiles.length > 0,
          // Every mounted tile is from the never-shown tail.
          shownBeforeSave: tiles.filter((tile) => firstWindow.has(tile.index))
            .length,
          gray: tiles.filter((tile) => tile.placeholder).length,
          // Even index: orientation 1 (landscape); odd: 6 (portrait).
          notUpright: tiles
            .filter((tile) =>
              tile.index % 2 === 1
                ? !(tile.height > tile.width)
                : !(tile.width > tile.height),
            )
            .map((tile) => tile.index),
        }
      },
      { timeout: 60_000 },
    )
    .toEqual({ mounted: true, shownBeforeSave: 0, gray: 0, notUpright: [] })
})
