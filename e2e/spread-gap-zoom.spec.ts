import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  KIT_GAP_RATIO,
  readGapRatios,
  spreadBoxes,
  zoomOutToFloor,
} from './fixtures/stackGap'
import { readZoomPercent } from './fixtures/zoomMenu'

// Owner bug 2026-10-31: the gap between spreads jumped with zoom (smallest
// zoomed in, largest zoomed out). It is now a fixed share of the spread
// height: kit #/demo at 1440 × 900 has 44 px under its 588 px Fit spread.

const SAME = 0.02

async function sessionBookWithThreeSpreads(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
  const count = Number(
    await page
      .getByTestId('pasteboard-scroll')
      .getAttribute('data-spread-count'),
  )
  await addSpreads(page, Math.max(0, 3 - count))
}

function expectSameRatio(ratios: readonly number[], expected: number): void {
  expect(ratios.length).toBeGreaterThan(0)
  for (const ratio of ratios) {
    expect(Math.abs(ratio / expected - 1)).toBeLessThanOrEqual(SAME)
  }
}

async function firstGapPx(page: Page): Promise<number> {
  const [prev, next] = await spreadBoxes(page)
  assert(prev !== undefined && next !== undefined)
  return next.y - (prev.y + prev.height)
}

async function stepZoom(page: Page, step: 'zoom-in' | 'zoom-out') {
  const before = await readZoomPercent(page)
  await page.getByTestId(step).click()
  await expect.poll(() => readZoomPercent(page)).not.toBe(before)
}

test.describe('stack gap scales with zoom', () => {
  test.beforeEach(async ({ page }) => {
    await sessionBookWithThreeSpreads(page)
  })

  test('gap / spread height is the kit share at the floor, Fit and zoomed in', async ({
    page,
  }) => {
    const fit = await readGapRatios(page)
    expectSameRatio(fit, KIT_GAP_RATIO)
    const fitGap = await firstGapPx(page)

    for (let i = 0; i < 3; i += 1) await stepZoom(page, 'zoom-in')
    expectSameRatio(await readGapRatios(page), KIT_GAP_RATIO)
    // The gap grew with the spreads instead of staying 44 screen px.
    expect(await firstGapPx(page)).toBeGreaterThan(fitGap * 1.5)
    // Zoomed in, only the pasteboard scrolls; the document does not.
    await assertNamedScrollport(page, 'pasteboard-scroll', {
      axis: 'vertical',
    })

    await zoomOutToFloor(page)
    expectSameRatio(await readGapRatios(page), KIT_GAP_RATIO)
    expect(await firstGapPx(page)).toBeLessThan(fitGap / 2)
    await assertDocumentFitsViewport(page)
  })

  test('page numbers sit in the gap at Fit and hide once it is too short', async ({
    page,
  }) => {
    const slots = page.locator('[data-pasteboard-slot]')
    await expect(slots.nth(1).getByTestId('page-labels')).toBeVisible()
    const [first, second] = await spreadBoxes(page)
    assert(first !== undefined && second !== undefined)
    const label = await slots
      .first()
      .locator('.page-label:not(:empty)')
      .boundingBox()
    assert(label !== null)
    expect(
      Math.abs(label.y - (first.y + first.height) - 6),
    ).toBeLessThanOrEqual(1)
    expect(label.y + label.height).toBeLessThanOrEqual(second.y)

    await zoomOutToFloor(page)
    await expect(page.getByTestId('page-labels')).toHaveCount(0)
    expect(await readGapRatios(page)).not.toHaveLength(0)
  })
})

test('an asset drag shows the drop pill inside the scaled gap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  const pill = page.getByTestId('pasteboard-gap').first()
  await expect(pill).toHaveCSS('opacity', '0')

  await page.evaluate(
    ({ mime }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, 'painter-a')
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      document
        .querySelector('[data-testid="pasteboard-scroll"]')
        ?.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            clientX: 10,
            clientY: 10,
            dataTransfer,
          }),
        )
    },
    { mime: ASSET_DRAG_MIME },
  )

  await expect(pill).toHaveCSS('opacity', '1')
  const [first, second] = await spreadBoxes(page)
  assert(first !== undefined && second !== undefined)
  const box = await pill.boundingBox()
  assert(box !== null)
  expect(box.y).toBeGreaterThanOrEqual(first.y + first.height - 0.5)
  expect(box.y + box.height).toBeLessThanOrEqual(second.y + 0.5)
  expect(box.height).toBeGreaterThan(0)
})
