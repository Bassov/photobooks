import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Designer frame-context-menu FM4 (prod pick mode = kit FM2,
// e2e/kit-photo-pick.spec.ts): "Replace photo…" / "Place photo…" hand the
// next filmstrip click / Enter to the frame (src/editor/photoPick.ts).

const REPLACE_STATUS =
  'Click a photo in the filmstrip to replace this one · Esc to cancel'
const PLACE_STATUS =
  'Click a photo in the filmstrip to place it here · Esc to cancel'

interface Setup {
  filled: Locator
  empty: Locator
  assets: string[]
}

const strip = (page: Page) => page.getByTestId('filmstrip')
const thumbs = (page: Page) => page.getByTestId('filmstrip-item')
const status = (page: Page) => page.getByTestId('editor-status')
const undoLabel = (page: Page) =>
  page.getByTestId('undo').getAttribute('aria-label')

/** Three photos; a 2 × 1 sheet with the first photo in frame A, B empty. */
async function setup(page: Page): Promise<Setup> {
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
    photoFixturePaths.metaLake,
  ])
  await expect(thumbs(page)).toHaveCount(3, { timeout: 30_000 })
  await applyContactSheet(page, 2, 1)
  const view = page.getByTestId('spread-view').first()
  const frames = view.getByTestId('spread-frame')
  await expect(frames).toHaveCount(2)
  const ids = await frames.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-frame-id') ?? ''),
  )
  const assets = await thumbs(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-asset-id') ?? ''),
  )
  const filled = view.locator(`button[data-frame-id="${ids[0] ?? ''}"]`)
  const empty = view.locator(`button[data-frame-id="${ids[1] ?? ''}"]`)
  await dropAssetOnFrame(page, assets[0] ?? '', filled)
  await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
  await expect(empty).toHaveAttribute('data-filled', 'false')
  return { filled, empty, assets }
}

async function startPick(page: Page, frame: Locator, row: string) {
  await frame.click({ button: 'right' })
  await page.getByTestId(row).click()
  await expect(strip(page)).toHaveAttribute('data-picking', '')
}

test.describe('Photo pick from the filmstrip (FM4)', () => {
  test.beforeAll(() => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
  })

  test('Replace photo… rings the filmstrip, a click on thumb 3 replaces in one undo step', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, assets } = await setup(page)
    const before = await undoLabel(page)
    // Paint: the strip's left edge pixel turns from light chrome to the dark
    // 2 px ring (hygiene rule: pixels, not only computed style).
    const mid = await strip(page).evaluate((el) => el.clientHeight / 2)
    const edge = async () =>
      Math.max(
        ...((await pixelsAt(strip(page), [{ x: 0.5, y: mid }]))[0] ?? []).slice(
          0,
          3,
        ),
      )
    expect(await edge()).toBeGreaterThan(150)
    await startPick(page, filled, 'frame-menu-replace')
    expect(await edge()).toBeLessThan(90)

    await expect(status(page)).toHaveText(REPLACE_STATUS)
    // The inset ring shifts nothing: no page-level overflow.
    await assertDocumentFitsViewport(page)
    const tag = filled.getByTestId('pick-tag')
    await expect(tag).toHaveText('Replacing')
    expect(
      await tag.evaluate((el) => {
        const s = getComputedStyle(el)
        return [s.fontSize, s.fontWeight, s.lineHeight, s.top, s.left]
      }),
    ).toEqual(['11px', '600', '16px', '-24px', '0px'])
    expect(
      await strip(page).evaluate((el) => getComputedStyle(el).boxShadow),
    ).toMatch(/inset 0px 0px 0px 2px$|^rgb\(.+\) 0px 0px 0px 2px inset$/)
    await expect(thumbs(page).nth(2)).toHaveCSS('cursor', 'copy')
    // A press inside the dock (the thumb) keeps the mode; the click picks.
    await thumbs(page).nth(2).click()
    await expect(filled).toHaveAttribute('data-asset-id', assets[2] ?? '')
    await expect(strip(page)).not.toHaveAttribute('data-picking')
    await expect(filled.getByTestId('pick-tag')).toHaveCount(0)
    await expect(status(page)).not.toHaveText(REPLACE_STATUS)
    await expect(filled).toHaveAttribute('aria-pressed', 'true')
    await expect(thumbs(page).nth(2)).not.toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(await undoLabel(page)).toBe('Undo “Replace photo” (Ctrl+Z)')

    await page.keyboard.press('Control+z')
    await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
    expect(await undoLabel(page)).toBe(before)
  })

  test('focus moves to the roving thumb; Enter on a focused thumb picks', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, assets } = await setup(page)
    await startPick(page, filled, 'frame-menu-replace')
    await expect(thumbs(page).first()).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(thumbs(page).nth(1)).toBeFocused()
    // Arrows move focus only while picking.
    await expect(thumbs(page).nth(1)).not.toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.keyboard.press('Enter')
    await expect(filled).toHaveAttribute('data-asset-id', assets[1] ?? '')
    await expect(strip(page)).not.toHaveAttribute('data-picking')
    expect(await undoLabel(page)).toBe('Undo “Replace photo” (Ctrl+Z)')
  })

  test('Esc cancels with no change; the frame stays selected', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, assets } = await setup(page)
    const before = await undoLabel(page)
    await startPick(page, filled, 'frame-menu-replace')
    await page.keyboard.press('Escape')
    await expect(strip(page)).not.toHaveAttribute('data-picking')
    await expect(status(page)).not.toHaveText(REPLACE_STATUS)
    await expect(filled).toHaveAttribute('aria-pressed', 'true')
    await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
    expect(await undoLabel(page)).toBe(before)
  })

  test('Place photo… on an empty frame places the clicked thumb', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { empty, assets } = await setup(page)
    await startPick(page, empty, 'frame-menu-place')
    await expect(status(page)).toHaveText(PLACE_STATUS)
    await expect(empty.getByTestId('pick-tag')).toHaveText('Placing')
    await thumbs(page).nth(1).click()
    await expect(empty).toHaveAttribute('data-asset-id', assets[1] ?? '')
    expect(await undoLabel(page)).toBe('Undo “Place photo” (Ctrl+Z)')
  })

  test('a locked frame offers the photo row disabled', async ({ page }) => {
    test.setTimeout(120_000)
    const { filled } = await setup(page)
    await filled.click()
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(filled).toHaveAttribute('data-locked', 'true')
    await filled.click({ button: 'right' })
    await expect(page.getByTestId('frame-menu-replace')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  test('a press in the dock (filter) keeps the mode; outside cancels with no op', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, assets } = await setup(page)
    const before = await undoLabel(page)
    await startPick(page, filled, 'frame-menu-replace')
    // The "Unplaced" filter on and off: both presses are inside the dock.
    await page.getByTestId('film-unplaced-only').click()
    await page.getByTestId('film-unplaced-only').click()
    await expect(thumbs(page)).toHaveCount(3)
    await expect(strip(page)).toHaveAttribute('data-picking', '')
    await expect(status(page)).toHaveText(REPLACE_STATUS)
    await page
      .getByTestId('pasteboard-scroll')
      .click({ position: { x: 8, y: 8 } })
    await expect(strip(page)).not.toHaveAttribute('data-picking')
    await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
    expect(await undoLabel(page)).toBe(before)
  })
})
