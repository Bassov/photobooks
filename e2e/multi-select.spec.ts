import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import {
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

// multi-select part 1 (Designer Spec "Canvas", "Clicks and keys"): Shift+click
// builds a set of frames on one spread (src/editor/frameSelection.ts); 2+
// selected show a dashed group box and no handles; Esc clears; Delete removes
// the set in one undo step.

/** Painter fixture spread 1: a 4-grid with four different photos. */
const spread = (page: Page) =>
  page.locator('[data-testid="spread-view"][data-spread-id="painter-spread-1"]')
const frames = (page: Page) => spread(page).getByTestId('spread-frame')
const pressed = (page: Page) =>
  spread(page).locator('[data-testid="spread-frame"][aria-pressed="true"]')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return box
}

async function assetIds(page: Page): Promise<(string | null)[]> {
  return frames(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-asset-id')),
  )
}

test.describe('multi-select: Shift+click, group box, Esc, Delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).first().scrollIntoViewIfNeeded()
  })

  test('Shift+click two frames: both pressed, no handles, group box = union + 4, no swap', async ({
    page,
  }) => {
    const before = await assetIds(page)
    const a = frames(page).nth(0)
    const b = frames(page).nth(1)
    await a.click()
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
    await b.click({ modifiers: ['Shift'] })

    await expect(pressed(page)).toHaveCount(2)
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)
    // Before this change the second click swapped the two photos.
    expect(await assetIds(page)).toEqual(before)
    await expect(b.locator('.spread-frame-body')).toHaveAttribute(
      'draggable',
      'false',
    )

    const group = spread(page).getByTestId('group-box')
    await expect(group).toHaveCount(1)
    const [boxA, boxB, boxG] = await Promise.all([
      boxOf(a),
      boxOf(b),
      boxOf(group),
    ])
    const left = Math.min(boxA.x, boxB.x)
    const top = Math.min(boxA.y, boxB.y)
    const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width)
    const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height)
    expect(Math.abs(boxG.x - (left - 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.y - (top - 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.x + boxG.width - (right + 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.y + boxG.height - (bottom + 4))).toBeLessThanOrEqual(
      0.5,
    )
    const paint = await group.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        style: s.outlineStyle,
        width: s.outlineWidth,
        color: s.outlineColor,
        bg: s.backgroundColor,
        events: s.pointerEvents,
      }
    })
    expect(paint).toEqual({
      style: 'dashed',
      width: '1px',
      color: 'rgb(142, 142, 142)',
      bg: 'rgba(0, 0, 0, 0)',
      events: 'none',
    })
    await assertDocumentFitsViewport(page)

    // Shift+click again: back to one frame with handles.
    await b.click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(1)
    await expect(a).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
    await expect(group).toHaveCount(0)

    // Shift+Enter on a focused frame toggles it too; Esc clears the set.
    await b.focus()
    await page.keyboard.press('Shift+Enter')
    await expect(pressed(page)).toHaveCount(2)
    expect(await assetIds(page)).toEqual(before)
    await page.keyboard.press('Escape')
    await expect(pressed(page)).toHaveCount(0)
    await expect(group).toHaveCount(0)
  })

  test('a plain click inside the set collapses it to that frame', async ({
    page,
  }) => {
    const before = await assetIds(page)
    await frames(page).nth(0).click()
    await frames(page)
      .nth(1)
      .click({ modifiers: ['Shift'] })
    await frames(page)
      .nth(2)
      .click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(3)
    await frames(page).nth(1).click()
    await expect(pressed(page)).toHaveCount(1)
    await expect(frames(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
    expect(await assetIds(page)).toEqual(before)
  })

  test('Delete with three selected, one locked, removes all three in one undo step', async ({
    page,
  }) => {
    const ids = await frames(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-frame-id')),
    )
    // Lock the third frame (Ctrl+Shift+L on a single selection).
    await frames(page).nth(2).click()
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frames(page).nth(2)).toHaveAttribute('data-locked', 'true')

    // The locked frame stays selected; Shift+click adds the other two.
    await frames(page)
      .nth(0)
      .click({ modifiers: ['Shift'] })
    await frames(page)
      .nth(1)
      .click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(3)
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)

    await page.keyboard.press('Delete')
    // The lock guards geometry and drops, not deletion (as the Delete frame
    // button): all three go.
    await expect(frames(page)).toHaveCount(1)
    await expect(frames(page).first()).toHaveAttribute(
      'data-frame-id',
      ids[3] ?? '',
    )
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Delete 3 frames” (Ctrl+Z)',
    )

    await page.getByTestId('undo').click()
    await expect(frames(page)).toHaveCount(4)
    expect(
      await frames(page).evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-frame-id')),
      ),
    ).toEqual(ids)
    await expect(frames(page).nth(2)).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Lock frame” (Ctrl+Z)',
    )
  })
})

test.describe('Multi-select frame-budget gates', () => {
  test('Shift+click and the group box draw log no LoAF', async ({ page }) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).nth(0).click()
    await expect(pressed(page)).toHaveCount(1)

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    for (const index of [1, 2, 3, 2, 1]) {
      await frames(page)
        .nth(index)
        .click({ modifiers: ['Shift'] })
      await page.waitForTimeout(120)
    }
    await expect(pressed(page)).toHaveCount(2)
    await expect(spread(page).getByTestId('group-box')).toHaveCount(1)
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafThenClear)
  })
})
