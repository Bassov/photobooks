import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Kit v0.10.0 baseline: uikit/src/sandbox/chrome.tsx (Filmstrip, SpreadsPanel),
// uikit/src/sandbox/v7.tsx (CoverSpread, BookInspector "cover").

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
})

async function dropFirstPhotoOnCover(page: Page): Promise<string> {
  await page.locator('[data-item="cover"]').click()
  const attr = await page
    .locator('[data-testid="filmstrip"] [data-asset-id]')
    .first()
    .getAttribute('data-asset-id')
  assert(attr !== null)
  const assetId = attr
  await page.evaluate(
    ({ mime, id }) => {
      const front = document.querySelector('[data-testid="cover-front"]')
      if (front === null) {
        throw new Error('missing cover front')
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      front.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
      front.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
    },
    { mime: ASSET_DRAG_MIME, id: assetId },
  )
  await expect(page.getByTestId('cover-front')).toHaveAttribute(
    'data-photo-id',
    assetId,
  )
  return assetId
}

test('#9: a cover photo counts as used and shows the placed check', async ({
  page,
}) => {
  await expect(page.getByTestId('placed-count')).toHaveText(
    'Photos · 2 · 0 used',
  )
  const assetId = await dropFirstPhotoOnCover(page)
  await expect(page.getByTestId('placed-count')).toHaveText(
    'Photos · 2 · 1 used',
  )
  await expect(
    page
      .locator(`[data-testid="filmstrip-item"][data-asset-id="${assetId}"]`)
      .getByTestId('filmstrip-placed'),
  ).toBeVisible()
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1)
})

test('#13: the cover canvas names its panels and shows the wrap guide', async ({
  page,
}) => {
  await page.locator('[data-item="cover"]').click()
  await expect(page.getByTestId('cover-label-back')).toHaveText('Back')
  await expect(page.getByTestId('cover-label-spine')).toHaveText('Spine')
  await expect(page.getByTestId('cover-label-front')).toHaveText('Front')
  await expect(page.getByTestId('cover-wrap-chip')).toHaveText('Wrap 15 mm')
  const guide = page.getByTestId('cover-safe')
  await expect(guide).toHaveCSS('outline-style', 'dashed')
  const [cover, inner] = await Promise.all([
    page.getByTestId('canvas-cover').boundingBox(),
    guide.boundingBox(),
  ])
  assert(cover !== null && inner !== null)
  expect(inner.x).toBeGreaterThan(cover.x)
  expect(inner.y).toBeGreaterThan(cover.y)
  expect(inner.x + inner.width).toBeLessThan(cover.x + cover.width)
  expect(inner.y + inner.height).toBeLessThan(cover.y + cover.height)
  // The list thumbnail stays plain: no labels or chip.
  await expect(
    page.locator('[data-testid="cover-list"] .cover-wrap-chip'),
  ).toHaveCount(0)
})

test('#14: the cover inspector lists the kit rows without fake inputs', async ({
  page,
}) => {
  await page.locator('[data-item="cover"]').click()
  const inspector = page.getByTestId('insp-cover')
  await expect(inspector).toContainText(
    'Hardcover · back, spine, front · wrap 15 mm',
  )
  await expect(inspector).toContainText('Full bleed')
  for (const label of [
    'Title font',
    'Spine width',
    'Direction',
    'Fill',
    'Material',
    'Finish',
  ]) {
    await expect(inspector.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(inspector.getByText('12 mm')).toBeVisible()
  // Superseded by #14 (design-inspector-book-cover): the same rows are now
  // real kit-backed controls instead of "coming later" placeholders.
  await expect(inspector.getByText('coming later')).toHaveCount(0)
  await expect(page.getByTestId('fill-readonly')).toHaveCount(0)
  await expect(page.getByTestId('material-readonly')).toHaveCount(0)
  await expect(inspector.getByTestId('cover-title-font')).toBeEnabled()
  await expect(inspector.getByTestId('cover-material')).toBeEnabled()
  await expect(inspector.getByTestId('cover-finish')).toBeEnabled()
  await expect(inspector.getByTestId('cover-back-fill')).toBeVisible()
  await expect(
    inspector.getByTestId('cover-spine-width').getByRole('slider'),
  ).toBeVisible()
  await expect(
    inspector.getByRole('radio', { name: 'Bottom to top' }),
  ).toBeAttached()
})

test('#10/#11: image-only kit-height tiles with no hover trash', async ({
  page,
}) => {
  const item = page.getByTestId('filmstrip-item').first()
  await expect(page.getByTestId('filmstrip-name')).toHaveCount(0)
  await expect(item).toHaveJSProperty('offsetHeight', 76)
  await item.hover()
  await expect(page.getByTestId('filmstrip-remove')).toHaveCount(0)
})

test('#11: Delete removes the selected photo from the gallery', async ({
  page,
}) => {
  await page.getByTestId('filmstrip-item').first().click()
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1)
})

test('#12: rows caption empty frames and the cover row takes the selected block', async ({
  page,
}) => {
  const empty = page.getByTestId('spread-row-empty').first()
  await expect(empty).toBeVisible()
  await expect(empty).toHaveText(/^\d+ empty$/)
  const row = page.locator('[data-item="cover"]')
  await row.click()
  await expect(row).toHaveCSS('background-color', 'rgb(202, 202, 202)')
})
