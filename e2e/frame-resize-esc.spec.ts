import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { expandDisclosure } from './fixtures/expandDisclosure'
import { layoutTile } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { waitForPasteboardSettled } from './fixtures/pasteboardSettled'

// Designer cycle-layouts p4 M160: Esc during a handle resize, then a release
// outside the frame, keeps the selection (kit e2e/kit-frame-drag-esc.spec.ts).
// The release click used to reach the pasteboard deselect.

test.use({ viewport: { width: 1440, height: 900 } })

const undoLabel = (page: Page) =>
  page.getByTestId('undo').getAttribute('aria-label')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('no box')
  return box
}

test('Esc mid-resize, release outside the frame: frame restored and still selected', async ({
  page,
}) => {
  await openSessionEditor(page)
  await waitForPasteboardSettled(page)
  await page.getByTestId('spread-list-item-spread-2').click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Pages 2–3/,
  )
  // The Designer walk applies "Hero + two" first (undo "Apply layout").
  await layoutTile(page, 'Hero + two').click()
  await expect(page.getByTestId('layout-cycle-name')).toHaveText('Hero + two')
  await waitForPasteboardSettled(page)
  const frame = page
    .locator('[data-spread-id][data-active="true"]')
    .getByTestId('spread-frame')
    .first()
  await frame.click()
  await expandDisclosure(page, 'Position & size')
  const geometry = page.getByTestId('inspector-geometry')
  await expect(geometry).toBeVisible()
  const resizeHandles = frame.locator(
    '[data-handle]:not([data-handle="rotate"])',
  )
  await expect(resizeHandles).toHaveCount(8)
  const label = await undoLabel(page)
  const start = await boxOf(frame)

  const se = await boxOf(frame.locator('[data-handle="se"]'))
  const sx = se.x + se.width / 2
  const sy = se.y + se.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 30, sy + 20, { steps: 4 })
  await expect
    .poll(async () => (await boxOf(frame)).width)
    .toBeGreaterThan(start.width + 10)
  await page.keyboard.press('Escape')
  // The release lands outside the restored frame.
  const end = { x: sx + 30, y: sy + 20 }
  expect(end.x).toBeGreaterThan(start.x + start.width)
  expect(end.y).toBeGreaterThan(start.y + start.height)
  await page.mouse.up()

  const after = await boxOf(frame)
  expect(Math.abs(after.x - start.x)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(after.y - start.y)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(after.width - start.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(after.height - start.height)).toBeLessThanOrEqual(0.5)
  await expect(resizeHandles).toHaveCount(8)
  await expect(geometry).toBeVisible()
  expect(await undoLabel(page)).toBe(label)
  await expect(page.getByTestId('layout-cycle-name')).toHaveText('Hero + two')
})

test('a plain resize still commits one "Resize frame"', async ({ page }) => {
  await openSessionEditor(page)
  await waitForPasteboardSettled(page)
  await page.getByTestId('spread-list-item-spread-2').click()
  const frame = page
    .locator('[data-spread-id][data-active="true"]')
    .getByTestId('spread-frame')
    .first()
  await frame.click()
  const start = await boxOf(frame)
  const se = await boxOf(frame.locator('[data-handle="se"]'))
  const sx = se.x + se.width / 2
  const sy = se.y + se.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 30, sy + 20, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => undoLabel(page)).toContain('Resize frame')
  expect((await boxOf(frame)).width).toBeGreaterThan(start.width + 10)
  await expect(
    frame.locator('[data-handle]:not([data-handle="rotate"])'),
  ).toHaveCount(8)
})
