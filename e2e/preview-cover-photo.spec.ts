import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// QA-3 (prod QA 2026-11-25): Preview shows the book as the published site
// does, so its closed book carries the Front photo the editor shows.

test.beforeAll(() => {
  ensurePhotoFixtures()
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function photoOnFront(page: Page): Promise<string> {
  await choosePhotoFolder(page, [photoFixturePaths.largeJpeg])
  const item = page.getByTestId('filmstrip-item')
  await expect(item).toHaveCount(1, { timeout: 60_000 })
  await expect
    .poll(async () => (await item.getAttribute('data-asset-id')) ?? '')
    .not.toBe('')
  const assetId = String(await item.getAttribute('data-asset-id'))
  await page.getByTestId('cover-list-item').click()
  await page.evaluate(
    ({ mime, id }) => {
      const front = document.querySelector('[data-testid="cover-front"]')
      if (front === null) throw new Error('missing cover front')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      // The sheet accepts drops right of the spine only: aim at the front.
      const box = front.getBoundingClientRect()
      for (const type of ['dragover', 'drop']) {
        front.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: box.x + box.width / 2,
            clientY: box.y + box.height / 2,
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
  return assetId
}

const rgb = (css: string): number[] =>
  (css.match(/\d+/g) ?? []).slice(0, 3).map(Number)

test('Preview opens on a closed book wearing the Front photo', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openSessionEditor(page)
  await photoOnFront(page)

  await page.getByTestId('present').click()
  const preview = page.getByTestId('site-preview')
  await expect(preview.getByTestId('ps-reader')).toBeVisible()
  await expect(preview.getByTestId('site-label')).toHaveText('Cover')

  const cover = preview.locator('.sb-cover').first()
  const photo = cover.locator('img')
  await expect(photo).toBeVisible()
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)
  expect(await photo.getAttribute('src')).toMatch(/^blob:/)

  // Paint: the photo, not the cloth, shows at the cover's centre.
  const face = await cover.evaluate((el) => ({
    cloth: getComputedStyle(el).backgroundColor,
    x: el.getBoundingClientRect().width / 2,
    y: el.getBoundingClientRect().height / 2,
  }))
  const cloth = rgb(face.cloth)
  const [centre = []] = await pixelsAt(cover, [{ x: face.x, y: face.y }])
  const diff = Math.max(...cloth.map((c, i) => Math.abs(c - Number(centre[i]))))
  expect(
    diff,
    `centre ${String(centre)} vs cloth ${String(cloth)}`,
  ).toBeGreaterThan(24)
})

test('Preview keeps the plain cloth with no Front photo', async ({ page }) => {
  await openSessionEditor(page)
  await page.getByTestId('present').click()
  const preview = page.getByTestId('site-preview')
  await expect(preview.getByTestId('ps-reader')).toBeVisible()
  await expect(preview.locator('.sb-cover').first()).toBeVisible()
  await expect(preview.locator('.sb-cover img')).toHaveCount(0)
})
