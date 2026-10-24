import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
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

test('empty gallery template change leaves status empty and shows no Placed badge', async ({
  page,
}) => {
  await openSessionEditor(page)

  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
  await expect(page.getByTestId('editor-status')).toHaveText('')
  await page.getByRole('radio', { name: '4-grid' }).click()

  await expect(page.getByRole('radio', { name: '4-grid' })).toBeChecked()
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
  await expect(page.getByTestId('editor-status')).toHaveText('')
  await assertDocumentFitsViewport(page)
})

test.describe('template change with photos', () => {
  test('a smaller template unplaces overflow photos and announces the count', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openSessionEditor(page)
    await page.bringToFront()
    await choosePhotoFolder(page, [
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
    ])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
      timeout: 30_000,
    })

    await page.getByRole('radio', { name: '4-grid' }).click()
    const active = page.getByTestId('spread-view').first()
    const first = page.getByTestId('filmstrip-item').nth(0)
    const second = page.getByTestId('filmstrip-item').nth(1)
    await first.focus()
    await page.keyboard.press('Space')
    await active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })

    await second.focus()
    await page.keyboard.press('Space')
    await active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2, {
      timeout: 30_000,
    })

    await page.getByRole('radio', { name: 'One per page' }).click()

    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1)
    await expect(page.getByTestId('editor-status')).toHaveText(
      '1 photo was unplaced from the spread',
    )
    await assertDocumentFitsViewport(page)
  })

  test('a template change that drops nothing keeps an earlier status', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openSessionEditor(page)
    await page.bringToFront()
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })

    await page.getByTestId('filmstrip-item').first().focus()
    await page.keyboard.press('Space')
    await page
      .getByRole('button', { name: 'Place photo', exact: true })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })

    await page.getByRole('grid', { name: 'Book gallery' }).focus()
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Unplace' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('editor-status')).toHaveText('Photo unplaced')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)

    await page.getByRole('radio', { name: 'Full bleed' }).click()

    await expect(page.getByRole('radio', { name: 'Full bleed' })).toBeChecked()
    await expect(page.getByTestId('editor-status')).toHaveText('Photo unplaced')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })
})
