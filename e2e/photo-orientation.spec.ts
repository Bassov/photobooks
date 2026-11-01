import assert from 'node:assert/strict'
import type { Locator, Page } from '@playwright/test'
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

type Quadrant = 'red' | 'dark' | 'magenta' | 'blue'

/**
 * Colours at 25%/25% and 75%/75% of a decoded image. The fixtures' raw
 * quadrants are red / dark over magenta / blue, so an upright, unmirrored
 * image has one corner pair per EXIF orientation.
 */
async function cornerQuadrants(image: Locator): Promise<[Quadrant, Quadrant]> {
  return image.evaluate(async (el) => {
    const img = el as HTMLImageElement
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('2d context unavailable')
    }
    ctx.drawImage(img, 0, 0)
    const at = (fx: number, fy: number): Quadrant => {
      const [r = 0, , b = 0] = ctx.getImageData(
        Math.floor(canvas.width * fx),
        Math.floor(canvas.height * fy),
        1,
        1,
      ).data
      if (r > 128) {
        return b > 128 ? 'magenta' : 'red'
      }
      return b > 128 ? 'blue' : 'dark'
    }
    return [at(0.25, 0.25), at(0.75, 0.75)]
  })
}

const cases = [
  ['EXIF 6', 'sampleOrient6Landscape', ['magenta', 'dark']],
  ['EXIF 8', 'sampleOrient8Landscape', ['dark', 'magenta']],
  ['EXIF 3', 'sampleOrient3Landscape', ['blue', 'red']],
  ['EXIF 1', 'sampleOrient1Landscape', ['red', 'blue']],
] as const

for (const [label, key, upright] of cases) {
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
    // Upright exactly once: a missed or doubled EXIF transform moves corners.
    await expect
      .poll(() => cornerQuadrants(item.getByTestId('filmstrip-thumb')))
      .toEqual(upright)

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
    // Working preview (1280 dual-tier decode) is upright too.
    await expect(image).toHaveAttribute('data-tier', '1280')
    await expect.poll(() => cornerQuadrants(image)).toEqual(upright)
  })
}
