import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt, type Point } from './fixtures/paintProbe'

// Designer cover-editor M95 (2026-11-06): the cover, endpaper and masters
// stages show the pasteboard dot grid of the spread workspace (kit dots
// 229–230 beside the sheet; prod painted a flat 198–200).

/** 16 × 16 px (one dot pitch) in the left side band, at mid height. */
const block = (height: number): Point[] =>
  Array.from({ length: 256 }, (_, i) => ({
    x: 8 + (i % 16),
    y: Math.round(height / 2) - 8 + Math.floor(i / 16),
  }))

interface Grid {
  /** Brightest red channel in the block. */
  dot: number
  /** Block indices of the dot pixels: the 16 px phase. */
  phase: number[]
  /** Darkest red channel: the canvas between the dots. */
  canvas: number
}

/** The block at the same page spot over the canvas, whatever stage is up. */
async function grid(page: Page): Promise<Grid> {
  const canvas = page.getByTestId('canvas')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('no canvas box')
  const red = (await pixelsAt(canvas, block(box.height))).map(([r = 0]) => r)
  return {
    dot: Math.max(...red),
    phase: red.flatMap((v, i) => (v >= 215 ? [i] : [])),
    canvas: Math.min(...red),
  }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
})

test('M95: cover, endpaper and masters stages keep the workspace dot grid', async ({
  page,
}) => {
  const spread = await grid(page)
  expect(spread.dot).toBeGreaterThanOrEqual(225)
  expect(spread.phase.length).toBeGreaterThan(0)

  // Dots ≥ 225 at the workspace phase (no jump spread ↔ stage) on the
  // canvas colour (opaque stage: no spread shows through; the endpaper
  // sheet shadow dims the band by a few levels).
  const sameGrid = async () => {
    const now = await grid(page)
    return {
      dot: now.dot >= 225,
      phase: now.phase,
      canvas: Math.abs(now.canvas - spread.canvas) <= 8,
    }
  }
  const want = { dot: true, phase: spread.phase, canvas: true }

  for (const [item, stage] of [
    ['cover-list-item', 'cover-stage'],
    ['endpaper-list-item-front', 'endpaper-stage'],
  ] as const) {
    await page.getByTestId(item).click()
    await expect(page.getByTestId(stage)).toBeVisible()
    await expect.poll(sameGrid).toEqual(want)
  }

  await page.getByTestId('left-tab-masters').click()
  await expect(page.getByTestId('masters-canvas')).toBeVisible()
  await expect.poll(sameGrid).toEqual(want)
})
