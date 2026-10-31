import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { expectStackGapRatio, spreadBoxes } from './fixtures/stackGap'
import { chooseZoom } from './fixtures/zoomMenu'

// Designer round 3 (2026-10-31) against the rendered kit #/demo at 1440 × 900.

interface Span {
  left: number
  right: number
  top: number
  bottom: number
}

async function spanOf(locator: Locator): Promise<Span> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
  }
}

/** Union of what the tool group actually paints (its laid-out children). */
async function toolControlsSpan(page: Page): Promise<Span> {
  return page
    .getByRole('toolbar', { name: 'Editor' })
    .locator(':scope > *')
    .evaluateAll((els) => {
      const boxes = els
        .map((el) => el.getBoundingClientRect())
        .filter((b) => b.width > 0 && b.height > 0)
      return {
        left: Math.min(...boxes.map((b) => b.left)),
        right: Math.max(...boxes.map((b) => b.right)),
        top: Math.min(...boxes.map((b) => b.top)),
        bottom: Math.max(...boxes.map((b) => b.bottom)),
      }
    })
}

for (const width of [1440, 1280]) {
  test(`M20 tool group is kit-centred between the left and right groups at ${String(width)}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await openLibraryBook(page)

    const group = await spanOf(page.getByRole('toolbar', { name: 'Editor' }))
    const controls = await toolControlsSpan(page)
    const leftEnd = (await spanOf(page.getByTestId('redo'))).right
    const rightStart = (await spanOf(page.getByTestId('zoom-out'))).left

    // The group hugs its tools (prod bug: it stretched and its tools sat left).
    expect(Math.abs(group.left - controls.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(group.right - controls.right)).toBeLessThanOrEqual(1)
    // Kit `mx-auto`: centred in the free space between history and zoom.
    const centre = (controls.left + controls.right) / 2
    expect(Math.abs(centre - (leftEnd + rightStart) / 2)).toBeLessThanOrEqual(1)
    // No overlap with the left or right groups, and still on one row.
    expect(controls.left).toBeGreaterThan(leftEnd)
    expect(controls.right).toBeLessThan(rightStart)
    expect(controls.bottom - controls.top).toBeLessThanOrEqual(36)
  })
}

test('M26 empty dock is the kit 160 px and the 19 × 23 Fit page is 513.25', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  await expect(page.getByTestId('filmstrip-empty')).toBeVisible()

  const dock = await spanOf(page.getByTestId('dock'))
  const head = await spanOf(page.locator('.editor-dock-head'))
  const empty = await spanOf(page.getByTestId('filmstrip-empty'))
  expect(dock.bottom - dock.top).toBe(160)
  expect(dock.bottom).toBe(900)
  expect(head.bottom - head.top).toBe(40)
  // Kit: strip p-1 pb-2 around a px-2 row of h-(--thumb) = 104, text left.
  expect(empty.bottom - empty.top).toBe(116)
  const text = await spanOf(
    page.getByText('No photos yet — add a folder or drop one here.'),
  )
  expect(text.left - dock.left).toBeCloseTo(20, 0)

  // Kit pasteboard 900 − 48 − 160 = 692; Fit is min((928 − 80) / SW,
  // (692 − 104) / SH): the 38 cm two-page width wins, so the page is
  // 848 × 230 / 380 = 513.25 tall (rendered #/demo, design-r3-canvas-fit).
  await chooseZoom(page, 'Fit spread')
  await expect
    .poll(async () => (await spreadBoxes(page))[0]?.height ?? 0)
    .toBeCloseTo(513.25, 0)
  // M36 gap is a share of the spread height, so it holds at any Fit height.
  await expectStackGapRatio(page)
})

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('M26 dock with photos stays the kit 132 px (76 px thumbs)', async ({
  page,
}) => {
  await installPhotoDirectoryPickerStub(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1, {
    timeout: 30_000,
  })

  // Settled layout: the first thumb row lays out a frame after the item mounts.
  await expect
    .poll(async () => {
      const dock = await spanOf(page.getByTestId('dock'))
      return [dock.bottom - dock.top, dock.bottom]
    })
    .toEqual([132, 900])
})
