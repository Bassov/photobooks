import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// Designer frame-copy-paste FC2 (D2, D8, "Alt-drag look"): in the kit `#/demo`
// editor, Alt held at the press on a frame starts a duplicate drag. After the
// 3 px slop a clone (opacity .85, select ring) follows the pointer while the
// original stays; release adds the copy as one undo step and selects it; Esc
// drops it. The press Alt does not bypass snapping until it is released and
// pressed again. Ctrl+D next repeats the drag delta.

const demo = (page: Page) => page.getByTestId('demo')
// spread 4 is the sample t-hero4 layout: five empty frames
const spread = (page: Page) =>
  demo(page).locator('[data-testid="canvas"] [data-spread="4"]')
const hero = (page: Page) => spread(page).locator('[data-testid="frame"]')
const clones = (page: Page) => spread(page).getByTestId('dup-clone')
const snapLines = (page: Page) => spread(page).getByTestId('snap-line')
const undo = (page: Page) => demo(page).getByTestId('undo')
const status = (page: Page) => demo(page).getByTestId('status')

test.beforeEach(async ({ page }) => {
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
  await spread(page).scrollIntoViewIfNeeded()
})

async function rect(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** A press point inside frame `i` (off the centre), in page px. */
async function pressAt(page: Page, i: number) {
  const b = await rect(hero(page).nth(i))
  return {
    x: Math.round(b.x + b.width * 0.3),
    y: Math.round(b.y + b.height * 0.3),
  }
}

/** Alt held from before the press; the pointer goes `dx`/`dy` px in 5 steps and stays down. */
async function altDrag(page: Page, i: number, dx: number, dy: number) {
  const p = await pressAt(page, i)
  await page.mouse.move(p.x, p.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 5 })
  return p
}

function near(a: number, b: number, tol = 1) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
}

test('Alt-press drag shows a ringed clone, release adds one selected copy at the drag delta, one undo step', async ({
  page,
}) => {
  const src = await rect(hero(page).nth(0))
  await altDrag(page, 0, 40, 30)
  await expect(clones(page)).toHaveCount(1)
  await expect(status(page)).toHaveText(
    'Release to place the copy · Esc to cancel',
  )
  // the original stays put; the clone is painted on top, at .85 with the select ring
  near((await rect(hero(page).nth(0))).x, src.x, 0.5)
  const clone = await rect(clones(page))
  near(clone.x - src.x, 40, 6)
  near(clone.y - src.y, 30, 6)
  expect((await topAt(clones(page)))[0]).toContain('dup-clone')
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
  const s = await rect(spread(page))
  const [px = []] = await pixelsAt(spread(page), [
    { x: clone.x - s.x - 1.5, y: clone.y - s.y + clone.height / 2 },
  ])
  // the 2 px ring paints at the clone's .85 over the light frame: within 48 of the ring colour (no ring = 200 off)
  expect(ring).toHaveLength(3)
  ring.forEach((c, k) => {
    near(px[k] ?? -255, c, 48)
  })
  // no handles while the copy is dragged
  await expect(spread(page).locator('[data-testid="sel-handle"]')).toHaveCount(
    0,
  )

  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(clones(page)).toHaveCount(0)
  await expect(hero(page)).toHaveCount(6)
  const made = await rect(hero(page).nth(5))
  near(made.x, clone.x)
  near(made.y, clone.y)
  near((await rect(hero(page).nth(0))).x, src.x, 0.5)
  await expect(undo(page)).toHaveAttribute(
    'aria-label',
    'Undo “Duplicate frame” (Ctrl+Z)',
  )
  // the copy alone is the selection: Delete removes it, the source stays
  await page.keyboard.press('Delete')
  await expect(hero(page)).toHaveCount(5)
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(6)
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(5)
  await expect(status(page)).toHaveText('')
})

test('Alt-drag on one frame of a selection duplicates the whole selection', async ({
  page,
}) => {
  await hero(page).nth(0).click({ force: true })
  await hero(page)
    .nth(1)
    .click({ force: true, modifiers: ['Shift'] })
  await altDrag(page, 1, 30, 40)
  await expect(clones(page)).toHaveCount(2)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(hero(page)).toHaveCount(7)
  await expect(spread(page).getByTestId('sel-outline')).toHaveCount(2)
  await expect(undo(page)).toHaveAttribute(
    'aria-label',
    'Undo “Duplicate 2 frames” (Ctrl+Z)',
  )
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(5)
})

test('Alt press + release under the slop selects only; Esc mid-drag dispatches nothing', async ({
  page,
}) => {
  const before = await undo(page).getAttribute('aria-label')
  const p = await pressAt(page, 2)
  await page.mouse.move(p.x, p.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(p.x + 2, p.y)
  await expect(clones(page)).toHaveCount(0)
  await page.mouse.up()
  await expect(hero(page)).toHaveCount(5)
  await expect(spread(page).getByTestId('sel-handle').first()).toBeVisible()

  await page.mouse.down()
  await page.mouse.move(p.x + 50, p.y + 20, { steps: 5 })
  await expect(clones(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(clones(page)).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(hero(page)).toHaveCount(5)
  await expect(undo(page)).toHaveAttribute('aria-label', before ?? '')
})

test('the press Alt snaps; Alt released and pressed again mid-drag bypasses snapping', async ({
  page,
}) => {
  const src = await rect(hero(page).nth(3))
  // 4 px right: the copy snaps back onto its original's edges
  const p = await altDrag(page, 3, 4, 0)
  await expect(snapLines(page).first()).toBeVisible()
  expect(Math.abs((await rect(clones(page))).x - (src.x + 4))).toBeGreaterThan(
    1,
  )
  // Alt up on a move, down again: the same 4 px now stays unsnapped
  await page.keyboard.up('Alt')
  await page.mouse.move(p.x + 5, p.y)
  await page.keyboard.down('Alt')
  await page.mouse.move(p.x + 4, p.y)
  await expect(snapLines(page)).toHaveCount(0)
  near((await rect(clones(page))).x, src.x + 4, 0.5)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(hero(page)).toHaveCount(6)
  near((await rect(hero(page).nth(5))).x, src.x + 4)
})

test('cursor is copy over a frame while Alt is held', async ({ page }) => {
  const p = await pressAt(page, 0)
  await page.mouse.move(p.x, p.y)
  const cursor = () =>
    page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el ? getComputedStyle(el).cursor : 'none'
    }, p)
  expect(await cursor()).not.toBe('copy')
  await page.keyboard.down('Alt')
  await expect.poll(cursor).toBe('copy')
  await page.keyboard.up('Alt')
  await expect.poll(cursor).not.toBe('copy')
})

test('Ctrl+D right after an Alt-drag duplicate repeats its delta (D8)', async ({
  page,
}) => {
  const src = await rect(hero(page).nth(0))
  // the full-height frame has room up and right, not down (the paste clamp would stop it at the bleed)
  await altDrag(page, 0, 36, -10)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(hero(page)).toHaveCount(6)
  const first = await rect(hero(page).nth(5))
  await page.keyboard.press('Control+d')
  await expect(hero(page)).toHaveCount(7)
  const second = await rect(hero(page).nth(6))
  near(second.x - first.x, first.x - src.x)
  near(second.y - first.y, first.y - src.y)
})
