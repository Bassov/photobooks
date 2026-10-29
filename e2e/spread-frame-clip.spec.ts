import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return box
}

/** Share of teal (the sample photo) pixels in a screenshot region. */
async function photoPixelShare(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const png = (await page.screenshot({ clip })).toString('base64')
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('no 2d context')
    }
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let teal = 0
    for (let i = 0; i < data.length; i += 4) {
      // Paper and page chrome are neutral; the sample photo is strongly green.
      if ((data[i + 1] ?? 0) - (data[i] ?? 0) > 40) {
        teal += 1
      }
    }
    return teal / (data.length / 4)
  }, png)
}

async function leftFrameOfSecondSpread(page: Page) {
  const spread = page.getByTestId('spread-view').nth(1)
  await spread.scrollIntoViewIfNeeded()
  return { spread, frame: spread.getByTestId('spread-frame').first() }
}

/** The landscape photo is cropped to the frame: nothing teal outside it. */
async function expectPhotoClippedToFrame(page: Page) {
  const { spread, frame } = await leftFrameOfSecondSpread(page)
  await expect(frame).toHaveAttribute('data-filled', 'true')
  const s = await boxOf(spread)
  const f = await boxOf(frame)
  // Margin between the page edge and the frame (left), and the spine side.
  const left = {
    x: s.x + 1,
    y: f.y + 8,
    width: f.x - s.x - 2,
    height: f.height - 16,
  }
  const right = {
    x: f.x + f.width + 1,
    y: f.y + 8,
    width: s.x + s.width / 2 - (f.x + f.width) - 2,
    height: f.height - 16,
  }
  const inside = {
    x: f.x + 4,
    y: f.y + 4,
    width: f.width - 8,
    height: f.height - 8,
  }
  expect(await photoPixelShare(page, inside)).toBeGreaterThan(0.9)
  expect(await photoPixelShare(page, left)).toBe(0)
  expect(await photoPixelShare(page, right)).toBe(0)
}

async function importLandscape(page: Page) {
  await page.locator('[data-testid^="spread-list-item-"]').nth(1).click()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  const item = page.getByTestId('filmstrip-item').first()
  await expect(item).toBeVisible({ timeout: 30_000 })
  return item
}

test('a landscape dragged from the filmstrip is clipped to the left frame of a two-frame spread', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  const item = await importLandscape(page)
  const { frame } = await leftFrameOfSecondSpread(page)
  await item.dragTo(frame)
  await expectPhotoClippedToFrame(page)
})

test('a landscape dropped on the left frame is clipped to it', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  const item = await importLandscape(page)
  const id = await item.getAttribute('data-asset-id')
  const { frame } = await leftFrameOfSecondSpread(page)
  await dropAssetOnFrame(page, id ?? '', frame)
  await expectPhotoClippedToFrame(page)
})
