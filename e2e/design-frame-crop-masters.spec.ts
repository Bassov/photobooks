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

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function placeOne(page: Page) {
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
  return page.locator('[data-testid="spread-frame"][data-filled="true"]')
}

test('Masters mode hides the book pages on the canvas and Pages brings them back', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await page.getByTestId('left-tab-masters').click()
  const stub = page.getByTestId('masters-canvas-stub')
  await expect(stub).toBeVisible()
  await expect(stub).toContainText('No masters yet')
  const covered = await page
    .getByTestId('spread-view')
    .first()
    .evaluate((el) => {
      const box = el.getBoundingClientRect()
      const top = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return top?.closest('[data-testid="masters-canvas-stub"]') !== null
    })
  expect(covered).toBe(true)
  await assertDocumentFitsViewport(page)

  await page.getByTestId('left-tab-pages').click()
  await expect(stub).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('the dragged frame dims while its photo is in flight and restores at dragend', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await placeOne(page)
  await frame.locator('.spread-frame-body').evaluate((body) => {
    body.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      }),
    )
  })
  await expect(frame).toHaveAttribute('data-drag-source', 'true')
  await expect(frame).toHaveCSS('opacity', '0.4')
  await page.evaluate(() => {
    document.dispatchEvent(new Event('dragend'))
  })
  await expect(frame).not.toHaveAttribute('data-drag-source', 'true')
})

test('Esc mid-drag keeps the frame and a click selects it again', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await placeOne(page)
  await frame.click()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  const box = await frame.boundingBox()
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 6, y + 6, { steps: 3 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  // Deselect, then a plain click selects the frame again.
  await page.keyboard.press('Escape')
  await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
  await frame.click()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
})

test('crop mode shows the chip and the whole photo beyond the frame', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await placeOne(page)
  await frame.dblclick()
  await expect(frame).toHaveAttribute('data-crop-active', 'true')
  await expect(page.getByTestId('crop-overlay-tag')).toHaveText('Crop · 100%')
  const ghost = page.getByTestId('spread-frame-ghost')
  const [g, f] = await Promise.all([ghost.boundingBox(), frame.boundingBox()])
  expect((g?.width ?? 0) * (g?.height ?? 0)).toBeGreaterThanOrEqual(
    (f?.width ?? 1) * (f?.height ?? 1) - 1,
  )
  await assertDocumentFitsViewport(page)
})
