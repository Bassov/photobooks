import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { pointOf } from './fixtures/locatorBox'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

const HINT =
  'Drag onto another frame to swap, or onto the filmstrip to take the photo back'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function openWithPlacedPhoto(page: Page) {
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
    timeout: 30_000,
  })
  await applyLayout(page, '4-grid')
  const active = page.getByTestId('spread-view').first()
  const assetId = await page
    .getByTestId('filmstrip-item')
    .first()
    .getAttribute('data-asset-id')
  await dropAssetOnFrame(
    page,
    String(assetId),
    active.getByRole('button', { name: 'Place photo', exact: true }).first(),
  )
  const frame = active.locator(
    '[data-testid="spread-frame"][data-filled="true"]',
  )
  await expect(frame).toHaveCount(1, { timeout: 30_000 })
  return frame
}

// Kit: uikit/src/sandbox/canvas.tsx:105-106 (hint), :299-304 (re-select).
test('frame drag shows the hint; Esc clears it and a click re-selects with handles', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await openWithPlacedPhoto(page)
  const status = page.getByTestId('editor-status')
  const { clientX: cx, clientY: cy } = await pointOf(frame)

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 40, { steps: 6 })
  await expect(status).toHaveText(HINT)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(status).toHaveText('')

  await page.mouse.click(cx, cy)
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('spread-frame-handles')).toHaveCount(1)
})

// Kit: uikit/src/sandbox/chrome.tsx:168-180 (grid · snap, − Fit +).
test('bar holds tools, grid · snap and Minus / Plus zoom; extra views live in the zoom menu', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('grid-topbar-toggle')).toBeVisible()
  await expect(page.getByTestId('snap-topbar-toggle')).toBeVisible()
  for (const id of ['rulers', 'guides', 'dpi']) {
    await expect(page.getByTestId(`${id}-topbar-toggle`)).toHaveCount(0)
  }
  await expect(page.getByTestId('zoom-out').locator('svg path')).toHaveCount(1)
  await expect(page.getByTestId('zoom-in').locator('svg path')).toHaveCount(2)

  await page.getByTestId('view-menu').click()
  await expect(page.getByTestId('view-rulers-item')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await page.getByTestId('view-rulers-item').click()
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await page.getByTestId('view-menu').click()
  await expect(page.getByTestId('view-rulers-item')).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('selecting an endpaper leaves the Select tool active, not Text', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.getByTestId('endpaper-list-item-front').click()
  await expect(page.getByTestId('canvas-endpaper')).toBeVisible()
  await expect(page.getByTestId('tool-select')).toBeChecked()
  await expect(page.getByTestId('tool-text')).not.toBeChecked()
})

// Kit: uikit/src/features/create-book.tsx:31, components/ui/numberfield.tsx:27-55.
test('custom size fields: "Width (cm)" labels, stepper, no unit suffix', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    await api.attachMemoryLibraryForTests()
    await api.createBookInLibrary()
    await api.leaveEditorForLibrary()
  })
  await page.getByTestId('new-book').click()
  await page.getByTestId('create-preset').click()
  await page.getByRole('listbox').getByRole('option').last().click()
  const custom = page.getByTestId('create-custom')
  await expect(custom.getByText('Width (cm)')).toBeVisible()
  await expect(custom.getByText('Height (cm)')).toBeVisible()
  await expect(custom.locator('.pb-field__unit')).toHaveCount(0)
  const width = page.getByTestId('create-custom-w')
  const before = Number(await width.inputValue())
  await custom.getByRole('button', { name: 'Increase' }).first().click()
  expect(Number(await width.inputValue())).toBeCloseTo(before + 0.1, 5)
  await width.focus()
  await expect(width.locator('..')).toHaveCSS('outline-style', 'none')
})
