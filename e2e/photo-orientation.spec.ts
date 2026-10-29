import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function importOne(page: Page, path: string): Promise<void> {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [path])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
}

const cases = [
  ['EXIF 6', 'sampleOrient6Landscape'],
  ['EXIF 8', 'sampleOrient8Landscape'],
  ['EXIF 3', 'sampleOrient3Landscape'],
] as const

for (const [label, key] of cases) {
  test(`${label} landscape photo: landscape filmstrip slot, cover-cropped in frame`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await importOne(page, photoFixturePaths[key])

    const item = page.getByTestId('filmstrip-item')
    await expect(item).toHaveAttribute('data-orientation', 'landscape')
    await expect
      .poll(async () => Number(await item.getAttribute('data-aspect')))
      .toBeGreaterThan(1)

    await applyLayout(page, 'Full bleed')
    await dragPlaceFirstFilmstripItem(page, 0)
    const image = page.getByTestId('spread-frame-image')
    await expect(image).toHaveCount(1, { timeout: 30_000 })
    const frame = page.locator(
      '[data-testid="spread-frame"][data-filled="true"]',
    )
    const box = await frame.boundingBox()
    assert(box !== null, 'frame not visible')
    const frameAspect = box.width / box.height
    // Landscape 2:1 photo into a frame narrower than 2:1: cover scales the
    // image past the frame width (no letterbox).
    expect(frameAspect).toBeLessThan(2)
    await expect
      .poll(async () =>
        image.evaluate((el) =>
          Number.parseFloat((el as HTMLElement).style.width),
        ),
      )
      .toBeCloseTo((2 / frameAspect) * 100, 0)
  })
}
