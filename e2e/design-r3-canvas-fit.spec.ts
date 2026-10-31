import { existsSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { chooseZoom, readZoomPercent } from './fixtures/zoomMenu'

// Design review r3 (2026-10-31) vs kit `#/demo`: Fit draws every spread at the
// two-page width (uikit/src/sandbox/viewport.tsx `SW`), and a click on the
// selected frame keeps it selected (uikit/src/sandbox/canvas.tsx onFrameDown).

const rows = (page: Page) => page.locator('[data-testid^="spread-list-item-"]')
const zoomLabel = (page: Page) => page.getByTestId('zoom-label')
const context = (page: Page) => page.getByTestId('inspector-context')

/** The spread in pasteboard slot `index` is active and lies inside the port. */
async function activeSpreadInPort(page: Page, index: number): Promise<boolean> {
  return page.getByTestId('pasteboard-scroll').evaluate((port, slotIndex) => {
    const slot = port.querySelector(`[data-slot-index="${String(slotIndex)}"]`)
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (!(slot instanceof HTMLElement) || !(view instanceof HTMLElement)) {
      return false
    }
    const outer = port.getBoundingClientRect()
    const inner = view.getBoundingClientRect()
    return (
      slot.dataset.active === 'true' &&
      inner.width > 0 &&
      inner.left >= outer.left - 1 &&
      inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 &&
      inner.bottom <= outer.bottom + 1
    )
  }, index)
}

async function spreadCount(page: Page): Promise<number> {
  const count = await page
    .getByTestId('pasteboard-scroll')
    .getAttribute('data-spread-count')
  return Number(count)
}

async function openNineteenByTwentyThree(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    await api.attachMemoryLibraryForTests()
    await api.createBookInLibrary('Lake trip', {
      trim: { widthMm: 190, heightMm: 230 },
    })
  })
  await expect(page.getByTestId('book-size')).toContainText('19 × 23 cm', {
    timeout: 15_000,
  })
}

const books: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'session 30 × 30 book', open: openSessionEditor },
  { name: 'new 19 × 23 book', open: openNineteenByTwentyThree },
]

test.describe('M9: Fit follows the active spread', () => {
  for (const book of books) {
    test(`page 1, spread 2–3 and the last page each fit at Fit (${book.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await book.open(page)
      await expect(zoomLabel(page)).toHaveText('Fit')
      const last = (await spreadCount(page)) - 1
      expect(last).toBeGreaterThanOrEqual(2)

      for (const index of [0, 1, last]) {
        await rows(page).nth(index).click()
        await expect
          .poll(() => activeSpreadInPort(page, index), { timeout: 10_000 })
          .toBe(true)
        await expect(zoomLabel(page)).toHaveText('Fit')
      }
      // "Fit" is the real fit for this trim, not a stale one from before the
      // book opened: an explicit Fit spread keeps the zoom.
      const fitted = await readZoomPercent(page)
      await chooseZoom(page, 'Fit spread')
      await expect(zoomLabel(page)).toHaveText('Fit')
      expect(await readZoomPercent(page)).toBe(fitted)
      await assertDocumentFitsViewport(page)
    })
  }

  test('a manual zoom is kept on a spread change and is not labelled Fit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    await expect(zoomLabel(page)).toHaveText('Fit')
    const fit = await readZoomPercent(page)
    await page.getByTestId('zoom-out').click()
    await expect.poll(() => readZoomPercent(page)).not.toBe(fit)
    const zoomed = await readZoomPercent(page)
    await expect(zoomLabel(page)).toHaveText(zoomed)

    await rows(page).nth(1).click()
    await expect
      .poll(() => activeSpreadInPort(page, 1), { timeout: 10_000 })
      .toBe(true)
    expect(await readZoomPercent(page)).toBe(zoomed)
    await expect(zoomLabel(page)).toHaveText(zoomed)
  })
})

test.describe('M3/M4: a click on the selected frame keeps it selected', () => {
  test.beforeAll(() => {
    // Generate the PNG only when missing: workers race on rewrites.
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
    await page.bringToFront()
  })

  async function expectSelected(frame: Locator): Promise<void> {
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
  }

  async function expectDeselected(page: Page, frame: Locator): Promise<void> {
    await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)
  }

  test('drop, then a click on the same frame: Photo inspector and 8 handles stay', async ({
    page,
  }) => {
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
    const frame = page.locator(
      '[data-testid="spread-frame"][data-filled="true"]',
    )
    await expect(frame).toHaveCount(1, { timeout: 30_000 })
    await expectSelected(frame)
    await expect(context(page)).toHaveText('Photo')

    await frame.click()
    await expectSelected(frame)
    await expect(context(page)).toHaveText('Photo')
    await frame.click()
    await expectSelected(frame)
    await expect(context(page)).toHaveText('Photo')

    // Double-click still enters crop.
    await frame.dblclick()
    await expect(frame).toHaveAttribute('data-crop-active', 'true')
  })

  test('click, click again on an empty frame: still selected; Escape and the empty pasteboard deselect', async ({
    page,
  }) => {
    const frame = page
      .getByTestId('pasteboard-scroll')
      .locator('[data-slot-index="0"] [data-testid="spread-frame"]')
      .first()
    await frame.click()
    await expectSelected(frame)
    await frame.click()
    await expectSelected(frame)

    await page.keyboard.press('Escape')
    await expectDeselected(page, frame)

    await frame.click()
    await expectSelected(frame)
    const port = await page.getByTestId('pasteboard-scroll').boundingBox()
    expect(port).not.toBeNull()
    await page.mouse.click((port?.x ?? 0) + 12, (port?.y ?? 0) + 12)
    await expectDeselected(page, frame)
  })
})
