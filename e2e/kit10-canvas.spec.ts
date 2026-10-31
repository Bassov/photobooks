import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'

test.describe('kit v0.10 canvas and pasteboard', () => {
  test('pasteboard is the dotted gray canvas with a centered spread', async ({
    page,
  }) => {
    await page.goto('/?fixture=painter')
    const spreadView = page
      .locator('[data-active="true"] [data-testid="spread-view"]')
      .first()
    await expect(spreadView).toBeVisible()
    const board = page.locator('.editor-workspace')
    await expect(board).toHaveCSS('background-color', 'rgb(200, 202, 203)')
    await expect(board).toHaveCSS('background-image', /radial-gradient/)
    // A single page sits on its half of a spread-wide slot (round 7, M45):
    // the slot is what is centred.
    const spread = await page
      .locator('[data-pasteboard-slot][data-active="true"]')
      .first()
      .boundingBox()
    const scroll = await page.getByTestId('pasteboard-scroll').boundingBox()
    expect(spread).not.toBeNull()
    expect(scroll).not.toBeNull()
    const left = (spread?.x ?? 0) - (scroll?.x ?? 0)
    const right =
      (scroll?.x ?? 0) +
      (scroll?.width ?? 0) -
      ((spread?.x ?? 0) + (spread?.width ?? 0))
    expect(Math.abs(left - right)).toBeLessThan(24)
    await assertDocumentFitsViewport(page)
  })

  test('clicking the gray pasteboard selects that spread', async ({ page }) => {
    await page.goto('/?fixture=painter')
    const slots = page.getByTestId('pasteboard-slot')
    await expect(slots.first()).toBeVisible()
    const scroll = await page.getByTestId('pasteboard-scroll').boundingBox()
    const slot = await slots.first().boundingBox()
    expect(scroll).not.toBeNull()
    expect(slot).not.toBeNull()
    await page.mouse.click(
      (scroll?.x ?? 0) + 4,
      (slot?.y ?? 0) + (slot?.height ?? 0) / 2,
    )
    await expect(slots.first()).toHaveAttribute('data-active', 'true')
  })
})
