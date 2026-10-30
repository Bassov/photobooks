import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import {
  ASSET_DRAG_MIME,
  dragPlaceFirstFilmstripItem,
} from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Neutral --parent (#6b696a) is within 2/255 of gray; color-mix may
// serialize as color(srgb r g b / a), so read the first three numbers.
const nearGray = (css: string): boolean => {
  const m = css.match(/\d+(\.\d+)?/g)
  if (m === null || m.length < 3) {
    return false
  }
  const scale = css.startsWith('color(') ? 255 : 1
  const channels = m.slice(0, 3).map((v) => Number(v) * scale)
  return Math.max(...channels) - Math.min(...channels) <= 3
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

// Kit v0.10 drag-place-replace (uikit demo steps 13 and 15): grayscale drop
// target (tinted overlay, select outline, chip), dashed hint on other empty
// frames, black "used" disc on placed filmstrip tiles.
test('drop target and placed marker use the grayscale kit look', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  const items = page.getByTestId('filmstrip-item')
  await expect(items).toHaveCount(2, { timeout: 30_000 })
  await page.bringToFront()

  const hoverOver = (frameIndex: number, assetId: string) =>
    page.evaluate(
      ({ mime, id, index }) => {
        const frames = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-testid="spread-view"] [data-frame-id]',
          ),
        )
        const frame = frames[index]
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (frame === undefined || !(scroll instanceof HTMLElement)) {
          throw new Error('missing frame or pasteboard')
        }
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, id)
        document.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        const box = frame.getBoundingClientRect()
        scroll.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: box.left + box.width / 2,
            clientY: box.top + box.height / 2,
          }),
        )
      },
      { mime: ASSET_DRAG_MIME, id: assetId, index: frameIndex },
    )
  const endDrag = () =>
    page.evaluate(() =>
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true })),
    )
  const pseudo = (selector: string, which: '::before' | '::after') =>
    page.evaluate(
      ({ sel, pe }) => {
        const el = document.querySelector(sel)
        if (el === null) {
          throw new Error(`no ${sel}`)
        }
        const cs = getComputedStyle(el, pe)
        return {
          background: cs.backgroundColor,
          outlineColor: cs.outlineColor,
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          content: cs.content,
          color: cs.color,
        }
      },
      { sel: selector, pe: which },
    )
  const firstId = await items.nth(0).getAttribute('data-asset-id')
  const secondId = await items.nth(1).getAttribute('data-asset-id')
  expect(firstId).toBeTruthy()
  expect(secondId).toBeTruthy()

  // Empty frame as drop target: overlay + select outline + "place" chip.
  await hoverOver(0, String(firstId))
  const hovered = '[data-drop-hover="true"]'
  await expect(page.locator(hovered)).toHaveCount(1)
  await expect(page.locator(hovered)).toHaveAttribute(
    'data-drop-label',
    'Release to place',
  )
  const overlay = await pseudo(hovered, '::before')
  expect(overlay.outlineWidth).toBe('2px')
  expect(overlay.outlineStyle).toBe('solid')
  expect(overlay.outlineColor).toBe('rgb(35, 34, 35)')
  expect(overlay.background).toMatch(/\/ 0\.2\)$/)
  expect(nearGray(overlay.background)).toBe(true)
  const chip = await pseudo(hovered, '::after')
  expect(chip.content).toBe('"Release to place"')
  expect(nearGray(chip.background)).toBe(true)
  expect(nearGray(chip.color)).toBe(true)

  // Other empty frames get the dashed idle hint while an asset is dragged.
  const hintTarget =
    '.pasteboard-scroll[data-asset-drag="true"] .spread-frame[data-filled="false"]:not([data-drop-hover="true"])'
  await expect(page.locator(hintTarget).first()).toBeAttached()
  const hint = await pseudo(hintTarget, '::before')
  expect(hint.outlineStyle).toBe('dashed')
  expect(hint.outlineWidth).toBe('1px')
  await endDrag()

  // Place, then the filled frame offers "replace" and the tile is marked.
  const placedId = await dragPlaceFirstFilmstripItem(page, 0)
  await expect(items.nth(0).getByTestId('filmstrip-placed')).toBeVisible()
  await expect(items.nth(1).getByTestId('filmstrip-placed')).toHaveCount(0)
  const disc = await items
    .nth(0)
    .getByTestId('filmstrip-placed')
    .evaluate((el) => {
      const cs = getComputedStyle(el)
      return { background: cs.backgroundColor, color: cs.color }
    })
  expect(disc.background).toMatch(/^rgba\(0, 0, 0, 0\.55\)$/)
  expect(disc.color).toBe('rgb(255, 255, 255)')

  await expect(page.locator('[data-filled="true"]').first()).toBeVisible()
  await hoverOver(0, String(secondId))
  expect(placedId).toBe(firstId)
  await expect(page.locator(hovered)).toHaveAttribute(
    'data-drop-label',
    'Release to replace',
  )
  await endDrag()
  await expect(page.locator(hovered)).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})
