import { expect, test } from './fixtures/coverage'
import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

/** Kit `viewport.tsx` FIT_TOP / FIT_BOTTOM. */
const FIT_TOP = 56
const POINT_TOLERANCE_PX = 2

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox()
  if (found === null) {
    throw new Error('element has no box')
  }
  return found
}

function firstSpread(page: Page): Locator {
  return page
    .getByTestId('pasteboard-scroll')
    .getByTestId('spread-view')
    .first()
}

/** Zoom settles after the wheel gesture commits; wait for a stable box. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(400)
}

/** Spread-relative coordinates of a client point. */
function relative(spread: Box, point: { x: number; y: number }) {
  return {
    u: (point.x - spread.x) / spread.width,
    v: (point.y - spread.y) / spread.height,
  }
}

function clientOf(spread: Box, rel: { u: number; v: number }) {
  return {
    x: spread.x + rel.u * spread.width,
    y: spread.y + rel.v * spread.height,
  }
}

async function expectPointHeld(
  page: Page,
  rel: { u: number; v: number },
  point: { x: number; y: number },
): Promise<void> {
  const after = clientOf(await box(firstSpread(page)), rel)
  expect(Math.abs(after.x - point.x)).toBeLessThanOrEqual(POINT_TOLERANCE_PX)
  expect(Math.abs(after.y - point.y)).toBeLessThanOrEqual(POINT_TOLERANCE_PX)
}

test.beforeEach(async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')
  await settle(page)
})

test('opens on the fitted spread with kit top air and no overlay chrome', async ({
  page,
}) => {
  const port = await box(page.getByTestId('pasteboard-scroll'))
  const spread = await box(firstSpread(page))
  expect(spread.y - port.y).toBeGreaterThanOrEqual(FIT_TOP - 1)
  const bottomAir = port.y + port.height - (spread.y + spread.height)
  expect(spread.y - port.y).toBeGreaterThanOrEqual(bottomAir - 1)
  expect(spread.x - port.x).toBeGreaterThanOrEqual(40 - 1)
  expect(spread.y + spread.height).toBeLessThanOrEqual(port.y + port.height)

  await expect(page.getByTestId('pasteboard-empty-card')).toHaveCount(0)
  await expect(page.getByTestId('pasteboard-placement-hint')).toHaveCount(0)
  await expect(page.getByTestId('dpi-badge')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('status chips are not painted on the canvas', async ({ page }) => {
  const pill = page.getByTestId('editor-status')
  const rect = await pill.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { width: r.width, height: r.height }
  })
  expect(rect.width).toBeLessThanOrEqual(1)
  expect(rect.height).toBeLessThanOrEqual(1)
})

test('wheel zoom keeps the point under the cursor in and out', async ({
  page,
}) => {
  const spread = await box(firstSpread(page))
  const point = {
    x: spread.x + spread.width * 0.3,
    y: spread.y + spread.height * 0.4,
  }
  const rel = relative(spread, point)
  await page.mouse.move(point.x, point.y)

  for (const delta of [-100, -100, -100, 100, 100, 100, 100]) {
    await page.mouse.wheel(0, delta)
    await settle(page)
    await expectPointHeld(page, rel, point)
  }
  await assertDocumentFitsViewport(page)
})

test('wheel zoom anchored off the spread keeps the point too', async ({
  page,
}) => {
  const port = await box(page.getByTestId('pasteboard-scroll'))
  const spread = await box(firstSpread(page))
  // Blank pasteboard right of the spread's left edge margin.
  const point = { x: port.x + 12, y: spread.y + spread.height / 2 }
  const rel = relative(spread, point)
  await page.mouse.move(point.x, point.y)
  await page.mouse.wheel(0, -100)
  await settle(page)
  await expectPointHeld(page, rel, point)
  await page.mouse.wheel(0, 100)
  await settle(page)
  await expectPointHeld(page, rel, point)
})

test('± buttons zoom about the viewport centre and never recentre', async ({
  page,
}) => {
  const port = await box(page.getByTestId('pasteboard-scroll'))
  const centre = { x: port.x + port.width / 2, y: port.y + port.height / 2 }

  // Pan the view off-centre with a cursor-anchored zoom first.
  const spread = await box(firstSpread(page))
  const cursor = { x: spread.x + 20, y: spread.y + 20 }
  await page.mouse.move(cursor.x, cursor.y)
  await page.mouse.wheel(0, -200)
  await settle(page)

  for (const id of ['zoom-in', 'zoom-in', 'zoom-out']) {
    const before = await box(firstSpread(page))
    const rel = relative(before, centre)
    await page.getByTestId(id).click()
    await settle(page)
    await expectPointHeld(page, rel, centre)
  }

  // The spread is still off-centre: nothing snapped it back.
  const after = await box(firstSpread(page))
  const spreadCentre = {
    x: after.x + after.width / 2,
    y: after.y + after.height / 2,
  }
  expect(
    Math.abs(spreadCentre.x - centre.x) + Math.abs(spreadCentre.y - centre.y),
  ).toBeGreaterThan(20)
})

test('keyboard zoom keeps the viewport centre and Fit recentres', async ({
  page,
}) => {
  const port = await box(page.getByTestId('pasteboard-scroll'))
  const centre = { x: port.x + port.width / 2, y: port.y + port.height / 2 }
  const fitted = await box(firstSpread(page))
  const rel = relative(fitted, centre)
  await page.keyboard.press('Control+=')
  await settle(page)
  await expectPointHeld(page, rel, centre)
  await page.keyboard.press('Control+0')
  await settle(page)
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')
  const refit = await box(firstSpread(page))
  expect(Math.abs(refit.y - fitted.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(refit.x - fitted.x)).toBeLessThanOrEqual(1)
})
