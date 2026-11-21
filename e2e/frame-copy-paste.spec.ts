import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Designer frame-copy-paste FC4: prod Ctrl/⌘+C / X / V / Shift+V / D on the
// canvas frame selection, values = kit (e2e/kit-frame-copy-paste.spec.ts).
// The session book: page 1 (right single, `spread-1`), Pages 2–3
// (`spread-2`, one frame per page) and the last page (left single,
// `spread-3`), every frame at the same page-local rect.

/** The kit's paste / duplicate step (D3, D8). */
const STEP_MM = 5

const canvas = (page: Page) => page.getByTestId('pasteboard-scroll')
const spread = (page: Page, n: number) =>
  canvas(page).locator(
    `[data-spread-id="spread-${String(n)}"] [data-testid="spread-view"]`,
  )
const frames = (page: Page, n: number) =>
  spread(page, n).getByTestId('spread-frame')
/** A frame by id; `NEW` = the selected one (pasted copies get `nextFrameId` ids). */
const NEW = 'selected'
const frame = (page: Page, n: number, id: string) =>
  id === NEW
    ? frames(page, n).and(page.locator('[aria-pressed="true"]'))
    : spread(page, n).locator(`[data-frame-id="${id}"]`)
const status = (page: Page) => page.getByTestId('editor-status')

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) {
    throw new Error('not visible')
  }
  return b
}

/** A frame's box relative to its spread view. */
async function local(page: Page, n: number, id: string) {
  await expect(frame(page, n, id)).toHaveCount(1)
  // one read: a reveal scroll can land between two boundingBox calls
  return frame(page, n, id).evaluate((el) => {
    const f = el.getBoundingClientRect()
    const s = el.closest('[data-testid="spread-view"]')?.getBoundingClientRect()
    if (s === undefined) {
      throw new Error('no spread view')
    }
    return { x: f.x - s.x, y: f.y - s.y, width: f.width, height: f.height }
  })
}

/**
 * Screen px of 5 mm at the current zoom, probed with an Escape-cancelled
 * Frame tool draw (e2e/free-frames.spec.ts).
 */
async function stepPx(page: Page): Promise<number> {
  await spread(page, 2).scrollIntoViewIfNeeded()
  const s = await box(spread(page, 2))
  // from the bottom margin (no frame there) up and right
  const x = s.x + s.width / 2
  const y = s.y + s.height - 6
  await page.keyboard.press('f')
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 100, y - 100, { steps: 3 })
  const size = await page
    .getByTestId('frame-draft')
    .getAttribute('data-size-mm')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByTestId('frame-draft')).toHaveCount(0)
  await page.keyboard.press('v')
  return (STEP_MM * 100) / Number(size?.split('x')[0])
}

function expectAt(
  got: { x: number; y: number; width: number; height: number },
  want: { x: number; y: number; width: number; height: number },
  dx = 0,
  dy = dx,
) {
  expect(Math.abs(got.x - want.x - dx)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(got.y - want.y - dy)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(got.width - want.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(got.height - want.height)).toBeLessThanOrEqual(0.5)
}

async function select(page: Page, n: number, id: string) {
  await frame(page, n, id).scrollIntoViewIfNeeded()
  await frame(page, n, id).click()
  await expect(frame(page, n, id)).toHaveAttribute('aria-pressed', 'true')
}

/** Delete a spread's only frame (it stays the active spread). */
async function clear(page: Page, n: number, id: string) {
  await select(page, n, id)
  await page.keyboard.press('Delete')
  await expect(frames(page, n)).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await openSessionEditor(page)
  await expect(frames(page, 2)).toHaveCount(2)
})

test('Ctrl+C says Copied frame; Ctrl+V pastes +5 mm, then +10 mm; one undo step each', async ({
  page,
}) => {
  const step = await stepPx(page)
  await select(page, 2, 'spread-2-f0')
  const src = await local(page, 2, 'spread-2-f0')
  await page.keyboard.press('Control+c')
  await expect(status(page)).toHaveText('Copied frame')
  await expect(status(page)).toHaveAttribute('data-pill', 'true')
  await page.keyboard.press('Control+v')
  await expect(frames(page, 2)).toHaveCount(3)
  // the copy alone is the selection
  await expect(frame(page, 2, NEW)).toHaveCount(1)
  await expect(frame(page, 2, 'spread-2-f0')).not.toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expectAt(await local(page, 2, NEW), src, step)
  await page.keyboard.press('Control+v')
  await expect(frames(page, 2)).toHaveCount(4)
  expectAt(await local(page, 2, NEW), src, 2 * step)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(3)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(2)
  // the copied status clears after 2 s
  await expect(status(page)).toHaveText('')
})

test('Ctrl+V on another spread pastes in place; page 1 shifts onto its page', async ({
  page,
}) => {
  await select(page, 2, 'spread-2-f0')
  const src = await local(page, 2, 'spread-2-f0')
  await page.keyboard.press('Control+c')
  // the last page is a left single: the left page's frame lands in place
  await clear(page, 3, 'spread-3-f0')
  await page.keyboard.press('Control+v')
  await expect(frames(page, 3)).toHaveCount(1)
  expectAt(await local(page, 3, NEW), src)
  // page 1 is a right single: the left page's frame moves onto it
  await clear(page, 1, 'spread-1-f0')
  await page.keyboard.press('Control+v')
  await expect(frames(page, 1)).toHaveCount(1)
  expectAt(await local(page, 1, NEW), src)
})

test('Ctrl+Shift+V pastes exactly in place and never steps', async ({
  page,
}) => {
  await select(page, 2, 'spread-2-f1')
  const src = await local(page, 2, 'spread-2-f1')
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+Shift+v')
  await expect(frames(page, 2)).toHaveCount(3)
  expectAt(await local(page, 2, NEW), src)
  await page.keyboard.press('Control+Shift+v')
  await expect(frames(page, 2)).toHaveCount(4)
  expectAt(await local(page, 2, NEW), src)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(3)
})

test('Ctrl+D duplicates +5 mm, then repeats the move of its copy', async ({
  page,
}) => {
  const step = await stepPx(page)
  await select(page, 2, 'spread-2-f0')
  const src = await local(page, 2, 'spread-2-f0')
  await page.keyboard.press('Control+d')
  await expect(frames(page, 2)).toHaveCount(3)
  const first = await local(page, 2, NEW)
  expectAt(first, src, step)
  // drag the copy (selected) right (down would clamp at the page bottom),
  // then duplicate it
  const b = await box(frame(page, 2, NEW))
  await page.mouse.move(b.x + b.width - 20, b.y + b.height - 20)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width + 20, b.y + b.height - 20, { steps: 6 })
  await page.mouse.up()
  const moved = await local(page, 2, NEW)
  expect(moved.x - first.x).toBeGreaterThan(20)
  await page.keyboard.press('Control+d')
  await expect(frames(page, 2)).toHaveCount(4)
  expectAt(await local(page, 2, NEW), moved, moved.x - src.x, moved.y - src.y)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(3)
})

test('Ctrl+X cuts the frame in one step; Ctrl+V puts it back in place', async ({
  page,
}) => {
  await select(page, 2, 'spread-2-f1')
  const src = await local(page, 2, 'spread-2-f1')
  await page.keyboard.press('Control+x')
  await expect(frames(page, 2)).toHaveCount(1)
  await page.keyboard.press('Control+v')
  await expect(frames(page, 2)).toHaveCount(2)
  expectAt(await local(page, 2, NEW), src)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(2)
})

async function openInspector(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

test('the Caption field keeps native copy / paste', async ({ page }) => {
  await openInspector(page)
  await select(page, 2, 'spread-2-f0')
  const inspector = page.getByTestId('inspector-panel')
  await inspector.getByRole('button', { name: 'Caption' }).click()
  const caption = inspector.getByTestId('caption-input')
  await caption.fill('Lake')
  await caption.press('Control+a')
  await caption.press('Control+c')
  await caption.press('End')
  await caption.press('Control+v')
  await expect(caption).toHaveValue('LakeLake')
  await caption.press('Control+d')
  await expect(frames(page, 2)).toHaveCount(2)
  await expect(status(page)).not.toHaveText('Copied frame')
})
