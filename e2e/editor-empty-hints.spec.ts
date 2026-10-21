import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('fresh session shows pasteboard empty card and Add photos opens the file input', async ({
  page,
}) => {
  // Prefer the hidden input path so e2e can assert the shared import seam.
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker')
  })
  await openSessionEditor(page)

  const card = page.getByTestId('pasteboard-empty-card')
  await expect(card).toBeVisible()
  await expect(card.getByText('Start with your photos')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Add folder…' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Add photos…' })).toBeVisible()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await card.getByRole('button', { name: 'Add photos…' }).click()
  const chooser = await fileChooserPromise
  expect(chooser.isMultiple()).toBe(true)

  await assertDocumentFitsViewport(page)
})

test('placement hint appears after import and clears after first place', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)

  await expect(page.getByTestId('pasteboard-empty-card')).toBeVisible()
  await page
    .getByTestId('photo-file-input')
    .setInputFiles([photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('pasteboard-empty-card')).toHaveCount(0)
  await expect(page.getByTestId('pasteboard-placement-hint')).toBeVisible()
  await expect(page.getByTestId('editor-status')).toContainText(
    'Drag a photo onto a frame',
  )

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
  await page.getByTestId('folder-file-input').setInputFiles(dir)
  await expect(page.getByTestId('pasteboard-empty-card')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('No photos found in that folder')).toBeVisible()
  await assertDocumentFitsViewport(page)
})
