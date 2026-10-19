import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'

test('clean library-backed book shows Saved without page scroll', async ({
  page,
}) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('save-book')).toBeEnabled({
    timeout: 15_000,
  })
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('autosave persists edits across reload without manual Save', async ({
  page,
}) => {
  test.setTimeout(90_000)
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('create-book')).toBeEnabled({
    timeout: 15_000,
  })
  page.once('dialog', (dialog) => {
    void dialog.accept('Autosave book')
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-status')).toHaveText('Book created')
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')
  await page.bringToFront()

  await page
    .getByTestId('photo-file-input')
    .setInputFiles([photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await page.bringToFront()
  const first = page.getByTestId('filmstrip-item').nth(0)
  await first.focus()
  await page.keyboard.press('Space')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  const place = page.getByRole('button', { name: 'Place photo' }).first()
  await place.focus()
  await expect(place).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })

  const templateGroup = page.getByRole('radiogroup', {
    name: 'Spread template',
  })
  await templateGroup.getByRole('radio', { name: '2-up' }).click()
  await expect(page.getByTestId('save-indicator')).toHaveText(/Unsaved|Saving/)

  await expect(page.getByTestId('save-indicator')).toHaveText('Saved', {
    timeout: 30_000,
  })
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 20_000,
  })
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  await expect(
    page
      .getByRole('radiogroup', { name: 'Spread template' })
      .getByRole('radio', {
        name: '2-up',
      }),
  ).toBeChecked()
  await expect(page.getByTestId('save-indicator')).toHaveText('Saved')

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})
