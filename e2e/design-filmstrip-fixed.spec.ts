import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
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

// Tracker #30 (fixed 76 px thumbs, no resize handle) is reversed by the
// Designer walkthrough-ux-review §B (Owner Q-19): the dock top edge is one
// separator (e2e/filmstrip-resize.spec.ts drives it). What stays pinned here:
// the `auto` thumb is the kit 76 px at 900 high, the old pre-#30 splitter and
// its `...thumbHeight` key stay gone, and below 90 px no file name shows.

const KIT_THUMB = 76

test.beforeAll(() => {
  // Every worker rewrites the fixtures; a rewrite while another worker reads
  // them makes the import fail and shifts the dock height. Write only if absent.
  if (
    !existsSync(photoFixturePaths.samplePng) ||
    !existsSync(photoFixturePaths.sampleOrient6)
  ) {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  }
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
  // The import / rescan status row is transient and changes the dock height
  // while it shows; measure only once it is gone.
  await expect(page.getByTestId('filmstrip-status')).toHaveCount(0, {
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

test('§B: one dock separator, no old splitter; stored thumbHeight is ignored', async ({
  page,
}) => {
  await importPhotos(page)
  await expect(page.getByTestId('dock').getByRole('separator')).toHaveCount(1)
  await expect(
    page.getByRole('separator', { name: 'Resize photos' }),
  ).toHaveAttribute('aria-valuenow', String(KIT_THUMB))
  await expect(page.getByTestId('film-splitter')).toHaveCount(0)
  await expect(page.getByLabel('Resize filmstrip')).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-item').first()).toHaveJSProperty(
    'offsetHeight',
    KIT_THUMB,
  )
})

test('§B: arrow keys on a thumb navigate, they do not resize the dock', async ({
  page,
}) => {
  await importPhotos(page)
  const before = await dockHeight(page)
  await page.getByTestId('filmstrip-item').first().focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  expect(await dockHeight(page)).toBe(before)
  await expect(page.getByTestId('filmstrip-item').first()).toHaveJSProperty(
    'offsetHeight',
    KIT_THUMB,
  )
})

test('§B: empty dock is the kit 132 px (row = auto H) across a reload with a stored thumbHeight', async ({
  page,
}) => {
  await expect(page.getByTestId('filmstrip-empty')).toBeVisible()
  const before = await dockHeight(page)
  // 40 header + 4 + 76 + 8 strip + 4 panel (kit #/demo empty dock).
  expect(before).toBe(132)

  await page.reload()
  await openSessionEditor(page)
  await expect(page.getByTestId('filmstrip-empty')).toBeVisible()
  expect(await dockHeight(page)).toBe(before)
})

test('#10: no filename text under 76 px thumbnails, accessible names stay', async ({
  page,
}) => {
  await importPhotos(page)
  await expect(page.getByTestId('filmstrip-name')).toHaveCount(0)
  await expect(page.locator('.filmstrip-name')).toHaveCount(0)
  const items = page.getByTestId('filmstrip-item')
  const count = await items.count()
  // Owner design change (round 16, M85): the kit "Low-res" chip is the only
  // text a thumb may carry; anything else (a file name) still fails.
  for (let i = 0; i < count; i += 1) {
    const text = await items.nth(i).evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement
      for (const chip of copy.querySelectorAll('[data-testid="lowres-chip"]')) {
        chip.remove()
      }
      return copy.textContent
    })
    expect(text.trim()).toBe('')
  }
  await expect(page.getByRole('row', { name: /\.(png|jpe?g)$/i })).toHaveCount(
    count,
  )
  const scrollText = await page.getByTestId('filmstrip-scroll').innerText()
  expect(scrollText).not.toMatch(/\.(png|jpe?g)/i)
})
