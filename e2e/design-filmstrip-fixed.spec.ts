import assert from 'node:assert/strict'
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

// Kit v0.10.0 baseline: the filmstrip thumb is fixed at 76 px
// (uikit/src/sandbox/store.tsx:64) and the demo has no resize handle; the name
// strip needs a thumb of 90 px or more (uikit/src/sandbox/chrome.tsx:471).

const KIT_THUMB = 76

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  // A height stored by the old resize handle must be ignored.
  await page.addInitScript(() => {
    window.localStorage.setItem('photobooks.filmstrip.thumbHeight', '96')
  })
  await openSessionEditor(page)
})

async function importPhotos(
  page: import('@playwright/test').Page,
): Promise<void> {
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
}

async function dockHeight(
  page: import('@playwright/test').Page,
): Promise<number> {
  const box = await page.getByTestId('dock').boundingBox()
  assert.ok(box)
  return box.height
}

test('#30: no separator or resize control; stored thumbHeight is ignored', async ({
  page,
}) => {
  await importPhotos(page)
  await expect(page.getByTestId('dock').getByRole('separator')).toHaveCount(0)
  await expect(page.getByTestId('film-splitter')).toHaveCount(0)
  await expect(page.getByLabel('Resize filmstrip')).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-item').first()).toHaveJSProperty(
    'offsetHeight',
    KIT_THUMB,
  )
})

test('#30: dock height is fixed across a drag on its top edge, keys and reload', async ({
  page,
}) => {
  await importPhotos(page)
  const before = await dockHeight(page)
  const box = await page.getByTestId('dock').boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y + 1)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 8 })
  await page.mouse.up()
  expect(await dockHeight(page)).toBe(before)

  await page.getByTestId('filmstrip-item').first().focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  expect(await dockHeight(page)).toBe(before)
  await expect(page.getByTestId('filmstrip-item').first()).toHaveJSProperty(
    'offsetHeight',
    KIT_THUMB,
  )
})

test('#30: empty dock height is fixed across a drag and a reload with a stored thumbHeight', async ({
  page,
}) => {
  await expect(page.getByTestId('filmstrip-empty')).toBeVisible()
  const before = await dockHeight(page)
  const box = await page.getByTestId('dock').boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y + 1)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 8 })
  await page.mouse.up()
  expect(await dockHeight(page)).toBe(before)

  await page.reload()
  await openSessionEditor(page)
  await expect(page.getByTestId('filmstrip-empty')).toBeVisible()
  expect(await dockHeight(page)).toBe(before)
})

test('#10: no filename text under thumbnails, accessible names stay', async ({
  page,
}) => {
  await importPhotos(page)
  await expect(page.getByTestId('filmstrip-name')).toHaveCount(0)
  await expect(page.locator('.filmstrip-name')).toHaveCount(0)
  const items = page.getByTestId('filmstrip-item')
  const count = await items.count()
  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i)
    expect((await item.innerText()).trim()).toBe('')
  }
  await expect(page.getByRole('row', { name: /\.(png|jpe?g)$/i })).toHaveCount(
    count,
  )
  const scrollText = await page.getByTestId('filmstrip-scroll').innerText()
  expect(scrollText).not.toMatch(/\.(png|jpe?g)/i)
})
