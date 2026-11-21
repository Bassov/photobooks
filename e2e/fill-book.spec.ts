import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Locator, Page } from '@playwright/test'
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

// Designer fill-book FB3 (prod); kit reference uikit/src/sandbox/chrome.tsx FillBook.

const PHOTOS = 12

function twelvePhotos(): string[] {
  const dir = join(tmpdir(), `pb-fill-book-${String(process.pid)}`)
  mkdirSync(dir, { recursive: true })
  return Array.from({ length: PHOTOS }, (_, index) => {
    const path = join(dir, `photo-${String(index + 1).padStart(2, '0')}.png`)
    copyFileSync(photoFixturePaths.samplePng, path)
    return path
  })
}

const rows = (page: Page): Locator =>
  page.locator('[data-testid^="spread-list-item-"]')
const chip = (page: Page): Locator => page.getByTestId('film-fill-book')
const wrap = (page: Page): Locator => page.getByTestId('film-fill-book-wrap')
const popover = (page: Page): Locator => page.getByTestId('fill-book-popover')

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('element has no box')
  }
  return box
}

async function labels(page: Page): Promise<string[]> {
  const texts = await rows(page).allInnerTexts()
  return texts.map((text) => text.trim().split('\n').at(-1)?.trim() ?? '')
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
})

test('the chip is disabled without photos and in Masters mode', async ({
  page,
}) => {
  await expect(chip(page)).toBeDisabled()
  await expect(wrap(page)).toHaveAttribute(
    'title',
    'Add a folder of photos first',
  )
  await choosePhotoFolder(page, twelvePhotos())
  await expect(page.getByTestId('placed-count')).toHaveText(
    `Photos · ${String(PHOTOS)} · 0 used`,
    { timeout: 30_000 },
  )
  await expect(chip(page)).toBeEnabled()
  await page.getByTestId('left-tab-masters').click()
  await expect(chip(page)).toBeDisabled()
  await expect(wrap(page)).toHaveAttribute(
    'title',
    'Switch to Pages to fill the book',
  )
})

test('Fill book fills a new book in photo order, one Ctrl+Z restores it', async ({
  page,
}) => {
  await choosePhotoFolder(page, twelvePhotos())
  const count = page.getByTestId('placed-count')
  await expect(count).toHaveText(`Photos · ${String(PHOTOS)} · 0 used`, {
    timeout: 30_000,
  })
  await expect(rows(page)).toHaveCount(3)

  // Chip = kit Add folder look, first in the right group, painted on top.
  const box = await boxOf(chip(page))
  const unplaced = await boxOf(page.getByTestId('film-unplaced-only'))
  expect(box.height).toBeCloseTo(28, 0)
  expect(unplaced.x - (box.x + box.width)).toBeCloseTo(8, 0)
  const hit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-testid="film-fill-book"]') !== null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  )
  expect(hit).toBe(true)

  // Esc closes with no change and focus goes back to the chip.
  await chip(page).click()
  await expect(popover(page)).toBeVisible()
  await expect(page.getByTestId('fill-book-confirm')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(popover(page)).toBeHidden()
  await expect(chip(page)).toBeFocused()
  await expect(rows(page)).toHaveCount(3)
  await expect(count).toHaveText(`Photos · ${String(PHOTOS)} · 0 used`)

  await chip(page).click()
  await expect(page.getByTestId('fill-book-order')).toHaveText(
    '12 unplaced photos, in Added order.',
  )
  await expect(page.getByTestId('fill-book-frames')).toHaveText('4 photos')
  await expect(page.getByTestId('fill-book-spreads')).toHaveText(
    '8 photos · 4 spreads',
  )
  await expect(page.getByTestId('fill-book-pages')).toHaveText('4 → 12')
  await expect(page.getByTestId('fill-book-left')).toHaveCount(0)
  // Kit popover box: 296 wide, padding 12, radius 8.
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector(
      '[data-testid="fill-book-popover"] [role="dialog"]',
    )
    const paint = dialog?.parentElement
    if (!dialog || !paint) return null
    return {
      width: paint.getBoundingClientRect().width,
      padding: getComputedStyle(dialog).padding,
      radius: getComputedStyle(paint).borderRadius,
    }
  })
  expect(geometry).not.toBeNull()
  expect(geometry?.width).toBeCloseTo(296, 0)
  expect(geometry?.padding).toBe('12px')
  expect(geometry?.radius).toBe('8px')

  // Designer R42 M152: kit text lines are 16.8 px, so the popover is 231.59 tall.
  const lines = await page.evaluate(() => {
    const byId = (id: string) => document.querySelector(`[data-testid="${id}"]`)
    // Row values and their labels (the value's previous sibling).
    const rowIds = ['fill-book-frames', 'fill-book-spreads', 'fill-book-pages']
    const nodes = [
      byId('fill-book-order'),
      byId('fill-book-cover'),
      ...rowIds.flatMap((id) => [byId(id), byId(id)?.previousElementSibling]),
    ]
    const heights = nodes
      .filter((el): el is Element => el instanceof Element)
      .map((el) => getComputedStyle(el).lineHeight)
    const box = document
      .querySelector('[data-testid="fill-book-popover"] [role="dialog"]')
      ?.parentElement?.getBoundingClientRect()
    return { heights, popover: box?.height ?? 0 }
  })
  expect(lines.heights).toHaveLength(8)
  expect(new Set(lines.heights)).toEqual(new Set(['16.8px']))
  expect(Math.abs(lines.popover - 231.59)).toBeLessThanOrEqual(0.5)

  await page.keyboard.press('Enter')
  await expect(popover(page)).toBeHidden()
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Placed 12 photos · added 4 spreads',
  )
  await expect(count).toHaveText(`Photos · ${String(PHOTOS)} · 12 used`)
  await expect(rows(page)).toHaveCount(7)
  expect(await labels(page)).toEqual([
    '1',
    '2–3',
    '4–5',
    '6–7',
    '8–9',
    '10–11',
    '12',
  ])
  await expect(chip(page)).toBeDisabled()
  await expect(wrap(page)).toHaveAttribute('title', 'Every photo is placed')

  // Page 12 holds the 12th photo in Added order.
  const lastRow = await rows(page).last().getAttribute('data-testid')
  const lastId = lastRow?.replace('spread-list-item-', '') ?? ''
  const twelfth = await page
    .locator('[data-testid="filmstrip"] [data-asset-id]')
    .nth(PHOTOS - 1)
    .getAttribute('data-asset-id')
  await rows(page).last().click()
  await expect(
    page.locator(
      `[data-spread-id="${lastId}"] .spread-frame[data-asset-id="${twelfth ?? ''}"]`,
    ),
  ).toHaveCount(1)

  await page.keyboard.press('ControlOrMeta+z')
  await expect(rows(page)).toHaveCount(3)
  await expect(count).toHaveText(`Photos · ${String(PHOTOS)} · 0 used`)
  await expect(chip(page)).toBeEnabled()
})
