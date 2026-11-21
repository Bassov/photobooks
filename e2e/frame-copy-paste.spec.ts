import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt, topAt } from './fixtures/paintProbe'

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

// FC5 (D2, D8, "Alt-drag look"), values = kit (e2e/kit-frame-alt-duplicate.spec.ts).
const clones = (page: Page) =>
  spread(page, 2).getByTestId('frame-duplicate-clone')
const undoLabel = (page: Page) =>
  page.getByTestId('undo').getAttribute('aria-label')

function near(a: number, b: number, tol = 1) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
}

/** Alt held from before the press, inside frame `id` (off its centre); stays down. */
async function altPress(page: Page, id: string) {
  await frame(page, 2, id).scrollIntoViewIfNeeded()
  const b = await box(frame(page, 2, id))
  const p = {
    x: Math.round(b.x + b.width * 0.3),
    y: Math.round(b.y + b.height * 0.3),
  }
  await page.mouse.move(p.x, p.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  return p
}

test('Alt-press drag paints a ringed clone; release adds one selected copy at the drag delta in one step; Ctrl+D repeats it', async ({
  page,
}) => {
  const src = await local(page, 2, 'spread-2-f0')
  const p = await altPress(page, 'spread-2-f0')
  await page.mouse.move(p.x + 30, p.y + 6, { steps: 5 })
  await expect(clones(page)).toHaveCount(1)
  await expect(status(page)).toHaveText(
    'Release to place the copy · Esc to cancel',
  )
  // the original stays put without its chrome; the clone is painted on top,
  // at .85 with the select ring
  expectAt(await local(page, 2, 'spread-2-f0'), src)
  // above the original it overlaps (only the editor's guides layer tops it)
  const stack = await topAt(clones(page))
  const above = stack.findIndex((ids) => ids.includes('frame-duplicate-clone'))
  expect(above).toBeGreaterThanOrEqual(0)
  expect(above).toBeLessThan(
    stack.findIndex((ids) => ids.includes('spread-frame')),
  )
  const look = await clones(page).evaluate((el) => {
    const cs = getComputedStyle(el)
    return { opacity: cs.opacity, shadow: cs.boxShadow }
  })
  expect(look.opacity).toBe('0.85')
  expect(look.shadow).toMatch(/0px 0px 0px 2px$/)
  const ring = (/rgba?\(([^)]+)\)/.exec(look.shadow)?.[1] ?? '')
    .split(',')
    .slice(0, 3)
    .map(Number)
  const clone = await box(clones(page))
  const s = await box(spread(page, 2))
  // right of the clone, 30 px past the original, over the paper: across the
  // 2 px ring (sub-pixel edges antialias), the darkest sample
  const samples = await pixelsAt(
    spread(page, 2),
    [0.5, 1, 1.5].map((dx) => ({
      x: clone.x - s.x + clone.width + dx,
      y: clone.y - s.y + clone.height / 2,
    })),
  )
  const sum = (rgb: number[]) => rgb.slice(0, 3).reduce((a, b) => a + b, 0)
  const px = samples.reduce((a, b) => (sum(b) < sum(a) ? b : a))
  // the ring at .85 over the light paper: near the ring colour (none = far off)
  expect(ring).toHaveLength(3)
  ring.forEach((c, k) => {
    near(px[k] ?? -255, c, 48)
  })
  await expect(spread(page, 2).getByTestId('sel-handle')).toHaveCount(0)

  // Alt released, then pressed again: no snapping, the copy lands at the
  // exact pointer delta
  await page.keyboard.up('Alt')
  await page.mouse.move(p.x + 38, p.y + 9, { steps: 2 })
  await page.keyboard.down('Alt')
  await page.mouse.move(p.x + 40, p.y + 8, { steps: 2 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(clones(page)).toHaveCount(0)
  await expect(frames(page, 2)).toHaveCount(3)
  await expect(frame(page, 2, NEW)).toHaveCount(1)
  const made = await local(page, 2, NEW)
  near(made.x - src.x, 40)
  near(made.y - src.y, 8)
  expectAt(await local(page, 2, 'spread-2-f0'), src)
  expect(await undoLabel(page)).toBe('Undo “Duplicate frame” (Ctrl+Z)')
  await expect(status(page)).toHaveText('')

  // D8: Ctrl+D next repeats the drag delta
  await page.keyboard.press('Control+d')
  await expect(frames(page, 2)).toHaveCount(4)
  const again = await local(page, 2, NEW)
  near(again.x - made.x, 40)
  near(again.y - made.y, 8)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await expect(frames(page, 2)).toHaveCount(2)
})

test('Alt shows the copy cursor; an Alt click selects; Esc mid Alt-drag adds nothing', async ({
  page,
}) => {
  const f1 = frame(page, 2, 'spread-2-f1')
  const cursor = () => f1.evaluate((el) => getComputedStyle(el).cursor)
  await f1.scrollIntoViewIfNeeded()
  await f1.hover()
  expect(await cursor()).toBe('pointer')
  await page.keyboard.down('Alt')
  await expect.poll(cursor).toBe('copy')
  await page.keyboard.up('Alt')
  await expect.poll(cursor).toBe('pointer')
  // the Frame tool keeps its own cursor under Alt
  await page.keyboard.press('f')
  await page.keyboard.down('Alt')
  expect(await cursor()).not.toBe('copy')
  await page.keyboard.up('Alt')
  await page.keyboard.press('v')

  const before = await undoLabel(page)
  // under the 3 px slop: a plain click selection, nothing added
  const p = await altPress(page, 'spread-2-f1')
  await page.mouse.move(p.x + 1, p.y + 1)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(f1).toHaveAttribute('aria-pressed', 'true')
  await expect(frames(page, 2)).toHaveCount(2)
  await expect(clones(page)).toHaveCount(0)

  // Esc mid-drag: the clone goes, no frame and no undo step
  const q = await altPress(page, 'spread-2-f0')
  await page.mouse.move(q.x + 40, q.y + 8, { steps: 5 })
  await expect(clones(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(clones(page)).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(frames(page, 2)).toHaveCount(2)
  expect(await undoLabel(page)).toBe(before)
})
