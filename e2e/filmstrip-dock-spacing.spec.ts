import { expect, test } from './fixtures/coverage'
import { ensurePhotoFixtures } from './fixtures/ensurePhotoFixtures'
import { photoFixturePaths } from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'
import type { Locator } from '@playwright/test'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return box
}

// Kit dock: header, then a p-1 thumbnail row, pb-2 + pb-1 below (uikit Dock).
test('dock is tight: no separate count line, small gaps around the thumbnails', async ({
  page,
}) => {
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  const items = page.getByTestId('filmstrip-item')
  await expect(items).toHaveCount(2, { timeout: 30_000 })

  // The header already says "Photos · N · M used"; no second "N photos" line.
  await expect(page.getByTestId('filmstrip-count')).toHaveCount(0)
  await expect(page.getByTestId('placed-count')).toHaveText(/^Photos · 2 · /)

  const head = await boxOf(page.locator('.editor-dock-head'))
  const first = await boxOf(items.first())
  const dock = await boxOf(page.getByTestId('dock'))
  const gapAbove = first.y - (head.y + head.height)
  const gapBelow = dock.y + dock.height - (first.y + first.height)
  expect(gapAbove).toBeLessThanOrEqual(8)
  // Kit: 8 + 4 below the row (scrollbar overlays); allow a few px of slack.
  expect(gapBelow).toBeLessThanOrEqual(20)
})
