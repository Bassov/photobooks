import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
  queuePhotoDirectoryPicker,
  stubPhotoFilesFromPaths,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

// Kit v0.10 Photos dock (uikit demo steps 10-12): Add folder in the dock,
// Unplaced + sort chips, no thumbnail size slider, no Assets tab.
test('dock header has kit chips and Add folder, no size slider', async ({
  page,
}) => {
  await openSessionEditor(page)
  const head = page.locator('.editor-dock-head')
  await expect(head.getByTestId('film-add-folder')).toHaveText('Add folder…')
  await expect(head.getByTestId('film-unplaced-only')).toHaveText('Unplaced')
  await expect(head.getByTestId('film-sort')).toHaveText('Added order')
  // No thumbnail size slider: the page's only sliders are the spread
  // inspector's kit Margin / Gap (context-inspector.tsx:245 Master & spacing).
  await expect(page.locator('.editor-dock').getByRole('slider')).toHaveCount(0)
  await expect(page.getByRole('slider')).toHaveCount(2)
  await expect(
    page.getByTestId('spread-master-spacing').getByRole('slider'),
  ).toHaveCount(2)
  await expect(page.getByText('Assets', { exact: true })).toHaveCount(0)
})

// Designer kit-sync P2: the kit's header chips are pills (radius 8 before),
// 28 px high, at rest and on hover.
test('dock header chips are kit pills at rest and on hover', async ({
  page,
}) => {
  await openSessionEditor(page)
  const head = page.locator('.editor-dock-head')
  const box = (id: string) =>
    head.getByTestId(id).evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        radius: Number.parseFloat(s.borderTopLeftRadius),
        height: el.getBoundingClientRect().height,
      }
    })
  for (const id of ['film-add-folder', 'film-unplaced-only', 'film-sort']) {
    const rest = await box(id)
    expect(rest.radius, id).toBeGreaterThanOrEqual(9999)
    expect(rest.height, id).toBe(28)
    await head.getByTestId(id).hover()
    expect((await box(id)).radius, id).toBeGreaterThanOrEqual(9999)
  }
})

test('Add folder fills the filmstrip; tiles show the file name on hover; used badge is black', async ({
  page,
}) => {
  await openSessionEditor(page)
  await queuePhotoDirectoryPicker(
    page,
    stubPhotoFilesFromPaths([
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
    ]),
  )
  await page.getByTestId('film-add-folder').click()
  const items = page.getByTestId('filmstrip-item')
  await expect(items.first()).toBeVisible({ timeout: 30_000 })
  await expect(items.first().locator('[title]').first()).toHaveAttribute(
    'title',
    /\S/,
  )
  await expect(page.getByTestId('placed-count')).toHaveText(/^Photos · \d+ · /)

  const scrolls = await page.evaluate(() => ({
    h: document.documentElement.scrollWidth > window.innerWidth,
    v: document.documentElement.scrollHeight > window.innerHeight,
  }))
  expect(scrolls).toEqual({ h: false, v: false })
})

test('sort labels follow the kit and the grayscale selection token holds', async ({
  page,
}) => {
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await page.getByTestId('film-sort').click()
  await expect(page.getByRole('menuitemradio')).toHaveText([
    'Date taken',
    'File name',
    'Added order',
  ])
  await page.keyboard.press('Escape')

  await page.getByTestId('filmstrip-item').first().click()
  const bg = await page
    .getByTestId('filmstrip-item')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgb(202, 202, 202)') // list / film selection #CACACA
})
