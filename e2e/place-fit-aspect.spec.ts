import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
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

/** Image element box aspect vs. the decoded bitmap aspect (1 = not stretched). */
async function stretchRatio(img: Locator): Promise<number> {
  return img.evaluate((node) => {
    const el = node as HTMLImageElement
    const box = el.getBoundingClientRect()
    return box.width / box.height / (el.naturalWidth / el.naturalHeight)
  })
}

test('placed portrait and landscape photos keep their aspect on canvas and in Pages thumbs', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await dragPlaceFirstFilmstripItem(page, 0)
  await dragPlaceFirstFilmstripItem(page, 1)

  const canvas = page
    .getByTestId('pasteboard-scroll')
    .getByTestId('spread-frame-image')
  const thumbs = page
    .getByTestId('spreads-list')
    .locator('.spread-view--thumb img')
  await expect(canvas).toHaveCount(2, { timeout: 30_000 })
  await expect(thumbs).toHaveCount(2, { timeout: 30_000 })

  for (const group of [canvas, thumbs]) {
    for (let i = 0; i < 2; i += 1) {
      const img = group.nth(i)
      await expect
        .poll(() => stretchRatio(img), { timeout: 15_000 })
        .toBeCloseTo(1, 1)
    }
  }
})

/** Gap (px) by which the frame sticks out past the image; 0 = no empty bars. */
async function uncoveredPx(img: Locator): Promise<number> {
  return img.evaluate((node) => {
    const image = node.getBoundingClientRect()
    const frame = (
      node.closest('.spread-frame') ?? node
    ).getBoundingClientRect()
    return Math.max(
      image.left - frame.left,
      frame.right - image.right,
      image.top - frame.top,
      frame.bottom - image.bottom,
      0,
    )
  })
}

test('a placed landscape photo covers its frame on canvas and in Pages thumbs', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await dragPlaceFirstFilmstripItem(page, 0)

  const canvas = page
    .getByTestId('pasteboard-scroll')
    .getByTestId('spread-frame-image')
  const thumbs = page
    .getByTestId('spreads-list')
    .locator('.spread-view--thumb img')
  await expect(canvas).toHaveCount(1, { timeout: 30_000 })
  await expect(thumbs).toHaveCount(1, { timeout: 30_000 })

  for (const group of [canvas, thumbs]) {
    await expect
      .poll(() => uncoveredPx(group.first()), { timeout: 15_000 })
      .toBeLessThanOrEqual(1)
  }
})
