import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Design review r2 M25: Preview renders the book only. The preview render path
// mounts no editor layer (ConnectedSpreadView `editorLayer={false}`), so none
// of the editor overlays below exist inside it; selection survives Preview.

const ACTIVE_SPREAD = '[data-active="true"] [data-testid="spread-view"]'

/** Editor overlay selectors (the data-testids / classes the overlays use). */
const EDITOR_OVERLAYS = {
  'resize handles': '[data-testid="sel-handle"]',
  'handle layer': '[data-testid="spread-frame-handles"]',
  'size pill': '[data-testid="frame-size-tag"]',
  'rotate handle': '[data-testid="rotate-handle"], .spread-frame-rotate',
  'selected frame (outline)': '.spread-frame[aria-pressed="true"]',
  'frame controls (hover outline)': 'button.spread-frame',
  'crop tag': '[data-testid="crop-overlay-tag"]',
  guides: '[data-testid="guides-layer"], [data-testid="guide-line"]',
  grid: '[data-testid="grid-overlay"]',
  'snap lines': '[data-testid="snap-line"]',
  'template preview': '[data-testid="tpl-preview"]',
}

async function pullGuide(page: Page) {
  await page.keyboard.press('Shift+R')
  const ruler = await page.getByTestId('ruler-x').boundingBox()
  const spread = await page.locator(ACTIVE_SPREAD).boundingBox()
  if (ruler === null || spread === null) throw new Error('not visible')
  const x = spread.x + spread.width * 0.75
  await page.mouse.move(x, ruler.y + ruler.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, spread.y + 60, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('guide-line')).toHaveCount(1)
}

test('Preview shows no selection, handles, pills, grid, guides or hover chrome; selection is back after', async ({
  page,
}) => {
  await openSessionEditor(page)
  await pullGuide(page)
  await page.keyboard.press("Control+'")
  await expect(
    page.locator(ACTIVE_SPREAD).getByTestId('grid-overlay'),
  ).toHaveCount(1)

  const frame = page.locator(ACTIVE_SPREAD).getByTestId('spread-frame').first()
  await frame.click()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
  // Owner design change (round 7, M52): no size tag exists in any mode.
  await expect(page.getByTestId('frame-size-tag')).toHaveCount(0)
  await frame.hover()

  await page.getByTestId('present').click()
  const stage = page.getByTestId('presentation')
  await expect(stage).toBeVisible()
  // Owner design change (round 7, M53): Preview opens on the cover; Next
  // shows the spread with the selected frame.
  await expect(page.getByTestId('pager-position')).toHaveText('Cover')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('pager-position')).toHaveText('1 / 3')
  await expect(stage.getByTestId('spread-frame').first()).toBeVisible()
  const counts: Record<string, number> = {}
  for (const [name, selector] of Object.entries(EDITOR_OVERLAYS)) {
    counts[name] = await stage.locator(selector).count()
  }
  expect(counts).toEqual(
    Object.fromEntries(Object.keys(EDITOR_OVERLAYS).map((name) => [name, 0])),
  )
  // No outline ring on any frame, hovered or not.
  await stage.getByTestId('spread-frame').first().hover()
  const rings = await stage
    .getByTestId('spread-frame')
    .evaluateAll((els) =>
      els.map((el) => getComputedStyle(el, '::after').outlineStyle),
    )
  expect(rings.length).toBeGreaterThan(0)
  expect(rings.filter((style) => style !== 'none')).toEqual([])

  await page.keyboard.press('Escape')
  await expect(stage).toHaveCount(0)
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
  await expect(page.getByTestId('frame-size-tag')).toHaveCount(0)
  await expect(page.getByTestId('guide-line')).toHaveCount(1)
  await expect(
    page.locator(ACTIVE_SPREAD).getByTestId('grid-overlay'),
  ).toHaveCount(1)
})
