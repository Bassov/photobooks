import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Designer frame-copy-paste FC1: the kit `#/demo` editor copies, cuts,
// pastes and duplicates frames. Ctrl+C says "Copied frame"; Ctrl+V pastes
// the same mm place, +5/+5 mm while that spot is taken; on another spread it
// pastes in place; Ctrl+Shift+V never steps; Ctrl+D repeats the last move of
// its copy; Ctrl+X skips locked frames. Each edit is one undo step.

const LOCKED = 'Frame is locked — unlock it in the inspector (Ctrl+Shift+L)'
const STEP_MM = 5

const demo = (page: Page) => page.getByTestId('demo')
// spread 4 is the sample t-hero4 layout: five empty frames; spread 3 is another sample layout
const spreadAt = (page: Page, i: number) =>
  demo(page).locator(`[data-testid="canvas"] [data-spread="${String(i)}"]`)
const framesOn = (page: Page, i: number) =>
  spreadAt(page, i).locator('[data-testid="frame"]')
const hero = (page: Page) => framesOn(page, 4)
const status = (page: Page) => demo(page).getByTestId('status')

async function openDemoBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(hero(page)).toHaveCount(5)
}

/** Keys go to the window, not to the spread list row a click focused. */
async function blur(page: Page) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
}

/** Pick frame `i` of spread 4 (that makes the spread current). */
async function pick(page: Page, i: number) {
  await hero(page).nth(i).click({ force: true })
  await expect(spreadAt(page, 4)).toHaveAttribute('data-current', 'true')
}

async function rect(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** Screen px per spread mm: a new #/demo book is A5 portrait, a 296 × 210 mm spread. */
async function pxPerMm(page: Page) {
  const s = await rect(spreadAt(page, 4))
  expect(Math.abs(s.width / s.height - 296 / 210)).toBeLessThan(0.01)
  return s.width / 296
}

const box = (page: Page, spread: number, i: number) =>
  rect(framesOn(page, spread).nth(i))

/** The lock toggle sits in the inspector's "Position & size" section, collapsed by default. */
async function lockSelected(page: Page) {
  const section = demo(page).getByRole('button', { name: 'Position & size' })
  const lock = demo(page).getByRole('button', { name: 'Lock (Ctrl+Shift+L)' })
  await expect(section).toBeVisible()
  if (!(await lock.isVisible())) await section.click()
  await lock.click()
}

async function expectOffset(
  page: Page,
  from: { x: number; y: number; width: number; height: number },
  to: { spread: number; i: number },
  mm: { x: number; y: number },
) {
  const k = await pxPerMm(page)
  const b = await box(page, to.spread, to.i)
  expect(Math.abs(b.x - from.x - mm.x * k)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.y - from.y - mm.y * k)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.width - from.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.height - from.height)).toBeLessThanOrEqual(0.5)
}

test.beforeEach(async ({ page }) => {
  await openDemoBook(page)
})

test('Ctrl+C says Copied frame; Ctrl+V pastes +5/+5 mm, then +10/+10, one undo step each', async ({
  page,
}) => {
  await pick(page, 0)
  const src = await box(page, 4, 0)
  await page.keyboard.press('Control+c')
  await expect(status(page)).toHaveText('Copied frame')
  await page.keyboard.press('Control+v')
  await expect(hero(page)).toHaveCount(6)
  await expectOffset(page, src, { spread: 4, i: 5 }, { x: STEP_MM, y: STEP_MM })
  // the copy alone is the selection: Del removes it, the source stays
  await page.keyboard.press('Delete')
  await expect(hero(page)).toHaveCount(5)
  await expectOffset(page, src, { spread: 4, i: 0 }, { x: 0, y: 0 })
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(6)
  await page.keyboard.press('Control+v')
  await expect(hero(page)).toHaveCount(7)
  await expectOffset(
    page,
    src,
    { spread: 4, i: 6 },
    { x: 2 * STEP_MM, y: 2 * STEP_MM },
  )
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(6)
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(5)
  // the copied status clears after 2 s
  await expect(status(page)).toHaveText('')
})

test('Ctrl+V on another spread pastes in place; Ctrl+Shift+V never steps', async ({
  page,
}) => {
  await pick(page, 1)
  const src = await box(page, 4, 1)
  const s4 = await rect(spreadAt(page, 4))
  await page.keyboard.press('Control+c')
  const before = await framesOn(page, 3).count()
  // a press on the paper makes spread 3 current (a spread row click does not); Esc drops any frame it picked
  await spreadAt(page, 3).click({ force: true, position: { x: 2, y: 2 } })
  await expect(spreadAt(page, 3)).toHaveAttribute('data-current', 'true')
  await page.keyboard.press('Escape')
  // the spread list keeps its own keys: Ctrl+V there pastes nothing
  await demo(page).locator('[data-item="p3"]').focus()
  await page.keyboard.press('Control+v')
  await expect(framesOn(page, 3)).toHaveCount(before)
  await blur(page)
  await page.keyboard.press('Control+v')
  await expect(framesOn(page, 3)).toHaveCount(before + 1)
  const s3 = await rect(spreadAt(page, 3))
  const b = await box(page, 3, before)
  expect(Math.abs(b.x - s3.x - (src.x - s4.x))).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.y - s3.y - (src.y - s4.y))).toBeLessThanOrEqual(0.5)
  await page.keyboard.press('Control+z')
  await expect(framesOn(page, 3)).toHaveCount(before)

  await pick(page, 1)
  await page.keyboard.press('Control+Shift+v')
  await expect(hero(page)).toHaveCount(6)
  await expectOffset(page, src, { spread: 4, i: 5 }, { x: 0, y: 0 })
})

test('Ctrl+D duplicates +5/+5 mm and repeats the copy’s move', async ({
  page,
}) => {
  // the left page's hero frame: its copies stay inside the spread (no clamp)
  await pick(page, 0)
  const src = await box(page, 4, 0)
  await page.keyboard.press('Control+d')
  await expect(hero(page)).toHaveCount(6)
  await expectOffset(page, src, { spread: 4, i: 5 }, { x: STEP_MM, y: STEP_MM })
  for (let n = 0; n < 4; n++) await page.keyboard.press('Shift+ArrowRight')
  await expectOffset(
    page,
    src,
    { spread: 4, i: 5 },
    { x: STEP_MM + 40, y: STEP_MM },
  )
  await page.keyboard.press('Control+d')
  await expect(hero(page)).toHaveCount(7)
  await expectOffset(
    page,
    src,
    { spread: 4, i: 6 },
    { x: 2 * (STEP_MM + 40), y: 2 * STEP_MM },
  )
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(6)
})

test('Ctrl+X cuts unlocked frames only; Ctrl+V puts the frame back', async ({
  page,
}) => {
  await pick(page, 3)
  await lockSelected(page)
  await pick(page, 3)
  await blur(page)
  await page.keyboard.press('Control+x')
  await expect(status(page)).toHaveText(LOCKED)
  await expect(hero(page)).toHaveCount(5)

  await pick(page, 4)
  const src = await box(page, 4, 4)
  await page.keyboard.press('Control+x')
  await expect(hero(page)).toHaveCount(4)
  await page.keyboard.press('Control+v')
  await expect(hero(page)).toHaveCount(5)
  await expectOffset(page, src, { spread: 4, i: 4 }, { x: 0, y: 0 })
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(4)
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(5)
})

test('Ctrl+D on a spread row still duplicates the spread', async ({ page }) => {
  const rows = demo(page).locator(
    '[data-testid="spreads-panel"] [data-item^="p"]',
  )
  const n = await rows.count()
  await demo(page).locator('[data-item="p4"]').click()
  await page.keyboard.press('Control+d')
  await expect(rows).toHaveCount(n + 1)
  await expect(status(page)).toHaveText(/^Pages .+ duplicated$/)
  // the copy of spread 4 has its five frames
  await expect(framesOn(page, 5)).toHaveCount(5)
})

test('the Caption field keeps native copy / paste', async ({ page }) => {
  await pick(page, 0)
  await demo(page)
    .getByTestId('ctx-inspector')
    .getByRole('button', { name: 'Caption', exact: true })
    .click()
  const caption = demo(page).getByTestId('caption-input')
  await caption.fill('Lake')
  await caption.press('Control+a')
  await caption.press('Control+c')
  await caption.press('End')
  await caption.press('Control+v')
  await expect(caption).toHaveValue('LakeLake')
  await expect(hero(page)).toHaveCount(5)
  await expect(status(page)).not.toHaveText('Copied frame')
})
