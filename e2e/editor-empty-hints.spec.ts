import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('fresh session shows pasteboard empty card and Choose photo folder imports from the picker', async ({
  page,
}) => {
  await openSessionEditor(page)

  const card = page.getByTestId('pasteboard-empty-card')
  await expect(card).toBeVisible()
  await expect(card.getByText('Start with your photos')).toBeVisible()
  await expect(
    card.getByRole('button', { name: 'Choose photo folder…' }),
  ).toBeVisible()

  await choosePhotoFolder(page, [photoFixturePaths.samplePng], {
    button: 'pasteboard',
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })

  await assertDocumentFitsViewport(page)
})

test('placement hint appears after import and clears after first place', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)

  await expect(page.getByTestId('pasteboard-empty-card')).toBeVisible()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('pasteboard-empty-card')).toHaveCount(0)
  const hint = page.getByTestId('pasteboard-placement-hint')
  await expect(hint).toBeVisible()
  await expect(hint).toContainText('Drag a photo onto a frame')
  await expect(hint).toHaveAttribute('role', 'status')

  const item = page.getByTestId('filmstrip-item').first()
  await page.bringToFront()
  await item.focus()
  await page.keyboard.press('Space')
  await expect(item).toHaveAttribute('aria-selected', 'true')

  const place = page.getByRole('button', { name: 'Place photo' }).first()
  await place.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('pasteboard-placement-hint')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('folder with only non-images keeps empty card and No photos found line', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-empty-folder-'))
  writeFileSync(join(dir, 'README.md'), '# no photos\n')

  await openSessionEditor(page)
  await choosePhotoFolder(page, [join(dir, 'README.md')])
  await expect(page.getByTestId('pasteboard-empty-card')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('No photos found in that folder')).toBeVisible()
  await expect(page.getByTestId('import-errors')).toHaveCount(0)
  await expect(page.getByTestId('editor-status')).toHaveText(
    '1 non-image file skipped',
  )
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})
