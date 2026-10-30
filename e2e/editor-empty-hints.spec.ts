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

// The pasteboard overlay card and placement hint pill are gone (kit #/demo
// shows only the empty frame and the empty filmstrip); import still works from
// the top-bar Choose photo folder button.
test('fresh session imports from the Choose photo folder picker', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('pasteboard-empty-card')).toHaveCount(0)

  await choosePhotoFolder(page, [photoFixturePaths.samplePng], {
    via: 'picker',
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('pasteboard-placement-hint')).toHaveCount(0)

  await assertDocumentFitsViewport(page)
})

test('folder with only non-images is reported and adds nothing', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-empty-folder-'))
  writeFileSync(join(dir, 'README.md'), '# no photos\n')

  await openSessionEditor(page)
  await choosePhotoFolder(page, [join(dir, 'README.md')])
  await expect(page.getByTestId('editor-status')).toHaveText(
    '1 non-image file skipped',
    { timeout: 15_000 },
  )
  await expect(page.getByTestId('import-errors')).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})
