import { existsSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { layoutTile } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Design review r2: kit v0.10.0 `#/demo` is the reference for every control.

test.beforeAll(() => {
  // Every worker rewriting the PNG races with another worker's import read
  // ("The requested file could not be read"); generate it only when missing.
  if (!existsSync(photoFixturePaths.samplePng)) {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  }
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  await page.bringToFront()
})

const context = (page: Page) => page.getByTestId('inspector-context')

async function importOnePhoto(page: Page) {
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
}

test('the inspector is open on a fresh editor with the Spread context and Layout picker (M1, M2)', async ({
  page,
}) => {
  // Open by default: uikit/src/features/parts.tsx:26; toggle:
  // uikit/src/sandbox/chrome.tsx:139; header: context-inspector.tsx:59.
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('inspector-panel')).toBeVisible()
  await expect(page.getByTestId('inspector-empty')).toHaveCount(0)
  await expect(context(page)).toHaveText('Spread')
  await expect(page.getByTestId('inspector-spread-summary')).toContainText(
    / · \d+ empty$/,
  )
  await expect(page.getByTestId('layout-section')).toBeVisible()
  await expect(page.getByTestId('tab-all')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('tab-mine')).toBeVisible()
  await expect(page.getByTestId('layout-search')).toBeVisible()
  await expect(page.getByTestId('tpl-chips')).toBeVisible()
  await expect(page.getByTestId('tpl-hint')).toBeVisible()
})

test('the Spread context has no Spread properties block (M2)', async ({
  page,
}) => {
  // uikit/src/sandbox/context-inspector.tsx:56-63: header, then Layout.
  await expect(context(page)).toHaveText('Spread')
  await expect(page.getByTestId('inspector-spread-properties')).toHaveCount(0)
  await expect(page.getByTestId('inspector-body').locator('dl')).toHaveCount(0)
  // Owner design change (round 7, M54): no inspector hide button.
  await expect(page.getByTestId('panel-collapse-right')).toHaveCount(0)
})

// uikit/src/sandbox/context-inspector.tsx:59 labels the first spread "Page 1"
// (moved from the Photo meta row, which the kit does not have).
test('the first spread header reads "Page 1 · N empty" (M2)', async ({
  page,
}) => {
  await page.locator('[data-testid^="spread-list-item-"]').first().click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Page 1 · \d+ empty$/,
  )
})

test('the panel toggle alone hides and restores the inspector (M1)', async ({
  page,
}) => {
  await page.getByTestId('toggle-r').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute(
    'data-open',
    'false',
  )
  await page.getByTestId('toggle-r').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')
  await expect(context(page)).toHaveText('Spread')
})

test('layout picker filters by photo count and search, and suggests layouts (M2)', async ({
  page,
}) => {
  // uikit/src/sandbox/context-inspector.tsx:163-195.
  const tiles = page.getByTestId('layout-tile')
  await expect(tiles).toHaveCount(10)
  await page.getByTestId('tpl-chips').locator('[data-chip="1"]').click()
  await expect(tiles.first()).toHaveAttribute('data-template', 'full-bleed')
  await expect(tiles).not.toHaveCount(10)
  await page.getByTestId('tpl-chips').locator('[data-chip="all"]').click()
  await page.getByTestId('layout-search').fill('grid')
  await expect(tiles).toHaveCount(1)
  await expect(layoutTile(page, 'Hero + grid')).toBeVisible()
  await page.getByTestId('layout-search').fill('zzz')
  await expect(page.getByTestId('tpl-empty')).toHaveText('No layouts match.')
  await page.getByTestId('layout-search').fill('')
  await page.getByTestId('tab-mine').click()
  await expect(page.getByTestId('tpl-empty')).toBeVisible()
  await page.getByTestId('tab-all').click()
  await expect(page.getByTestId('tpl-suggested')).toContainText(
    /Suggested for \d+ photos?/,
  )
})

test('dropping a photo selects the frame and opens the Photo inspector (M4)', async ({
  page,
}) => {
  await importOnePhoto(page)
  await expect(context(page)).toHaveText('Spread')
  await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
  const frame = page.locator('[data-testid="spread-frame"][data-filled="true"]')
  await expect(frame).toHaveCount(1, { timeout: 30_000 })
  // uikit/src/sandbox/canvas.tsx:170-171.
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(context(page)).toHaveText('Photo')
  await expect(page.getByTestId('inspector-photo')).toBeVisible()
})

test('Photo inspector has Rotate & flip, no canvas rotate knob, no meta rows (M7)', async ({
  page,
}) => {
  await importOnePhoto(page)
  await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
  const frame = page.locator('[data-testid="spread-frame"][data-filled="true"]')
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  // uikit/src/sandbox/canvas.tsx:224,443: no rotate knob on the select tool.
  await expect(page.getByTestId('rotate-handle')).toHaveCount(0)
  await expect(page.locator('.spread-frame-rotate-line')).toHaveCount(0)
  // uikit/src/sandbox/inspector.tsx:151-158.
  const rotate = page.getByTestId('inspector-rotate')
  await expect(
    page.getByTestId('inspector-rotate-disclosure').getByRole('heading'),
  ).toHaveText('Rotate & flip')
  await expect(rotate.getByTestId('rot-left')).toBeVisible()
  await expect(rotate.getByTestId('rot-right')).toBeVisible()
  await expect(rotate.getByTestId('flip-h')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  // uikit/src/sandbox/context-inspector.tsx:66-72: no meta rows, no Details.
  const body = page.getByTestId('inspector-body')
  await expect(page.getByTestId('inspector-details-disclosure')).toHaveCount(0)
  await expect(body.getByText('Used', { exact: true })).toHaveCount(0)
  await expect(body.getByText('File', { exact: true })).toHaveCount(0)
  await expect(body.locator('dl')).toHaveCount(0)
})

test('Flip H and Flip V mirror the photo and toggle back (M7)', async ({
  page,
}) => {
  await importOnePhoto(page)
  await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
  const image = page.getByTestId('spread-frame-image')
  await expect(image).toHaveCount(1, { timeout: 30_000 })
  const layerTransform = () =>
    page.evaluate(
      () =>
        document.querySelector<HTMLElement>(
          '[data-testid="spread-frame-image"]',
        )?.style.transform ?? '',
    )
  await page.getByTestId('flip-h').click()
  await expect(page.getByTestId('flip-h')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(layerTransform).toContain('scale(-1, 1)')
  await page.getByTestId('flip-v').click()
  await expect.poll(layerTransform).toContain('scale(-1, -1)')
  await page.getByTestId('flip-h').click()
  await expect.poll(layerTransform).toContain('scale(1, -1)')
  await page.getByTestId('flip-v').click()
  await expect(page.getByTestId('flip-v')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect.poll(layerTransform).not.toContain('scale(')
})
