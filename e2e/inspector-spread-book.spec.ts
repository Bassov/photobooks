import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function openInspectorTab(
  page: import('@playwright/test').Page,
  tab: 'spread' | 'book',
) {
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  if (tab === 'book') {
    await page.getByTestId('book-title').click()
  }
}

/** Kit Section: the Layout summary shows only while the section is collapsed. */
async function toggleLayoutSection(
  page: import('@playwright/test').Page,
  expanded: boolean,
) {
  const trigger = page
    .getByTestId('layout')
    .getByRole('button', { name: /^Layout/ })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', String(expanded))
}

test('applying a layout tile in the Spread tab re-flows the spread', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openInspectorTab(page, 'spread')
  const frames = page
    .getByTestId('spread-view')
    .first()
    .getByTestId('spread-frame')
  const tile = page.getByRole('button', { name: 'Apply layout Hero + grid' })
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
  await expect(frames).toHaveCount(5)
  await toggleLayoutSection(page, false)
  await expect(page.getByTestId('layout-summary')).toHaveText('Hero + grid')
  await toggleLayoutSection(page, true)
  await page.getByRole('button', { name: 'Apply layout Full bleed' }).click()
  await expect(frames).toHaveCount(1)
})

test('a contact sheet applies from the Spread tab Layout section', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openInspectorTab(page, 'spread')
  await page.getByTestId('layout-contact-apply').click()
  await toggleLayoutSection(page, false)
  await expect(page.getByTestId('layout-summary')).toHaveText(
    'Contact sheet 3×2',
  )
})

test('the Spread tab grid eye toggles the overlay', async ({ page }) => {
  test.setTimeout(90_000)
  await openInspectorTab(page, 'spread')
  const eye = page.getByTestId('grid-section-spread').getByTestId('grid-toggle')
  await expect(page.getByTestId('grid-overlay')).toHaveCount(0)
  await eye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('grid-overlay').first()).toBeVisible()
  await eye.click()
  await expect(page.getByTestId('grid-overlay')).toHaveCount(0)
})

test('the Book tab shows the book settings and the book grid', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openInspectorTab(page, 'book')
  await expect(page.getByTestId('book-settings')).toBeVisible()
  // Kit book settings have no Layout grid section (uikit/src/sandbox/v7.tsx:202-210).
  await expect(page.getByTestId('grid-section-book')).toHaveCount(0)
  await expect(page.getByTestId('layout-section')).toHaveCount(0)
})
