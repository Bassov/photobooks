import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ASSET_DRAG_MIME,
  dragPlaceFirstFilmstripItem,
} from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// The 6000×4000 fixture: filmstrip thumb long edge 320, working preview 1280.
const THUMB_EDGE = 320

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function importLargeJpeg(page: Page): Promise<string> {
  await choosePhotoFolder(page, [photoFixturePaths.largeJpeg])
  const item = page.getByTestId('filmstrip-item')
  await expect(item).toHaveCount(1, { timeout: 60_000 })
  await expect
    .poll(async () => (await item.getAttribute('data-asset-id')) ?? '')
    .not.toBe('')
  return String(await item.getAttribute('data-asset-id'))
}

async function dropOnCoverFront(page: Page, assetId: string): Promise<void> {
  await page.getByTestId('cover-list-item').click()
  await page.evaluate(
    ({ mime, id }) => {
      const front = document.querySelector('[data-testid="cover-front"]')
      if (front === null) {
        throw new Error('missing cover front')
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      for (const type of ['dragover', 'drop']) {
        front.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          }),
        )
      }
    },
    { mime: ASSET_DRAG_MIME, id: assetId },
  )
  await expect(page.getByTestId('cover-front')).toHaveAttribute(
    'data-photo-id',
    assetId,
  )
}

/** CSS background image of `el`: its URL and decoded natural width (0 if none). */
async function backgroundImage(
  el: Locator,
): Promise<{ url: string; width: number }> {
  return el.evaluate(async (node) => {
    const match = /url\("?([^")]+)"?\)/.exec(
      getComputedStyle(node).backgroundImage,
    )
    const url = match?.[1] ?? ''
    if (url === '') {
      return { url, width: 0 }
    }
    const img = new Image()
    img.src = url
    await img.decode()
    return { url, width: img.naturalWidth }
  })
}

/** Full-bleed place on the active spread; natural width of its 1280 preview. */
async function placeOnPageFrame(page: Page): Promise<number> {
  await applyLayout(page, 'Full bleed')
  await dragPlaceFirstFilmstripItem(page, 0)
  const image = page.getByTestId('spread-frame-image')
  await expect(image).toHaveAttribute('data-tier', '1280', { timeout: 60_000 })
  const width = await image.evaluate(async (el) => {
    const img = el as HTMLImageElement
    await img.decode()
    return img.naturalWidth
  })
  expect(width).toBeGreaterThan(THUMB_EDGE)
  return width
}

test('cover photo upgrades to the same working preview as a page frame', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openSessionEditor(page)
  const assetId = await importLargeJpeg(page)
  const thumbSrc = String(
    await page.getByTestId('filmstrip-thumb').getAttribute('src'),
  )

  await dropOnCoverFront(page, assetId)
  const front = page.getByTestId('cover-front')
  await expect
    .poll(async () => (await backgroundImage(front)).width, { timeout: 60_000 })
    .toBeGreaterThan(THUMB_EDGE)
  const cover = await backgroundImage(front)
  expect(cover.url).not.toBe(thumbSrc)

  await page.locator('[data-testid^="spread-list-item-"]').first().click()
  expect(cover.width).toBe(await placeOnPageFrame(page))
})

// The page frame alone already caches the working preview under the photo's
// cache key, so only the tile's own derivative choice decides this test.
test('library book card shows the cover working preview, not the thumb', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openLibraryBook(page)
  const assetId = await importLargeJpeg(page)
  const frameWidth = await placeOnPageFrame(page)
  await dropOnCoverFront(page, assetId)
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 20_000,
  })

  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  const tileCover = page.getByTestId('book-object-cover')
  await expect(tileCover).toHaveCount(1, { timeout: 15_000 })
  await expect
    .poll(async () => (await backgroundImage(tileCover)).width, {
      timeout: 30_000,
    })
    .toBe(frameWidth)
})
