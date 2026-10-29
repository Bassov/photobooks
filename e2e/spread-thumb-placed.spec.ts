import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function openEditor(page: Page, source: 'session' | 'library book') {
  if (source === 'session') {
    await openSessionEditor(page)
    return
  }
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
}

for (const source of ['session', 'library book'] as const) {
  test(`Pages-panel thumbnail shows a photo dragged into a frame (${source})`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openEditor(page, source)
    const row = page.locator('[data-testid^="spread-list-item-"]').nth(1)
    await row.click()
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    const item = page.getByTestId('filmstrip-item').first()
    await expect(item).toBeVisible({ timeout: 30_000 })
    await expect(row.locator('.spread-view--thumb img')).toHaveCount(0)

    const spread = page.getByTestId('spread-view').nth(1)
    await spread.scrollIntoViewIfNeeded()
    await item.dragTo(spread.getByTestId('spread-frame').first())

    // The canvas has the photo ...
    await expect(spread.getByTestId('spread-frame-image')).toHaveCount(1)
    // ... and so does the left-panel thumbnail of the same spread.
    await expect(row.locator('.spread-view--thumb img')).toHaveCount(1)
  })
}
