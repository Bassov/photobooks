import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
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

const CROP = 'rgb(107, 105, 106)' // --crop #6b696a
const FIELD = 'rgb(215, 215, 215)' // #D7D7D7

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function enterCrop(page: Page) {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await applyLayout(page, 'Full bleed', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  const frame = page.locator('[data-testid="spread-frame"][data-filled="true"]')
  await frame.dblclick()
  await expect(frame).toHaveAttribute('data-crop-active', 'true')
  return frame
}

test.describe('kit v0.10 crop in frame (demo step 19)', () => {
  test('crop chrome: #6b696a outline, field tag, 30% ghost, no blue', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const frame = await enterCrop(page)

    const ring = await frame.evaluate((el) => {
      const s = getComputedStyle(el, '::after')
      return { color: s.outlineColor, width: s.outlineWidth }
    })
    expect(ring).toEqual({ color: CROP, width: '2px' })

    const tag = page.getByTestId('crop-overlay-tag')
    await expect(tag).toHaveText('Crop · 100%')
    expect(
      await tag.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(FIELD)

    const ghost = page.getByTestId('spread-frame-ghost')
    await expect(ghost).toHaveCount(1)
    const paint = await ghost.evaluate((el) => {
      const s = getComputedStyle(el)
      return { opacity: s.opacity, outline: s.outlineStyle }
    })
    expect(paint).toEqual({ opacity: '0.3', outline: 'none' })
    await assertDocumentFitsViewport(page)
  })

  test('Esc leaves crop, second Esc clears the selection', async ({ page }) => {
    test.setTimeout(120_000)
    const frame = await enterCrop(page)
    await page.keyboard.press('Escape')
    await expect(frame).not.toHaveAttribute('data-crop-active', 'true')
    await expect(page.getByTestId('spread-frame-ghost')).toHaveCount(0)
    // Double-click clears the move-source selection before crop starts, so the
    // second Esc has nothing left to clear and must not re-enter crop.
    await page.keyboard.press('Escape')
    await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
    await expect(frame).not.toHaveAttribute('data-crop-active', 'true')
    await assertDocumentFitsViewport(page)
  })
})
