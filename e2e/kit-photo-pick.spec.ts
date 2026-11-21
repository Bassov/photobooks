import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Designer frame-context-menu FM2 (M3, "Pick mode"), kit `#/demo`: Replace
// photo… / Place photo… turn the filmstrip into the photo source. The dock
// grid gets a 2 px --select inset ring, thumbs a copy cursor, the frame a
// "Replacing" / "Placing" tag and the status line says how to finish. A click
// or Enter on a thumb is the same replace / place as a drop (one undo step);
// Esc or a press outside the dock cancels with no change.

test.use({ viewport: { width: 1440, height: 900 } })

const REPLACE_STATUS =
  'Click a photo in the filmstrip to replace this one · Esc to cancel'
const PLACE_STATUS =
  'Click a photo in the filmstrip to place it here · Esc to cancel'

const demo = (page: Page) => page.getByTestId('demo')
// spread 4 is the sample t-hero4 layout: five empty frames
const hero = (page: Page) =>
  demo(page).locator(
    '[data-testid="canvas"] [data-spread="4"] [data-testid="frame"]',
  )
const film = (page: Page) => demo(page).getByTestId('filmstrip')
const thumb = (page: Page, i: number) =>
  film(page).locator('[role="row"]').nth(i)
const row = (page: Page, id: string) => page.getByTestId(`frame-menu-${id}`)
const status = (page: Page) => demo(page).getByTestId('status')
const tag = (page: Page) => demo(page).getByTestId('pick-tag')

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
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(hero(page)).toHaveCount(5)
}

async function addPhotos(page: Page) {
  await demo(page).getByTestId('demo-add-folder').click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

/** Photos, then thumb 5 dropped into spread 4's frame 0. */
async function fillFrame0(page: Page) {
  await addPhotos(page)
  await thumb(page, 5).dragTo(hero(page).nth(0))
  await expect(hero(page).nth(0).locator('img')).toHaveCount(1)
  await page.mouse.move(5, 5)
  // the drag's 2.5 s "clear status" timer, so it cannot wipe the pick's result line
  await expect(status(page)).toHaveText('', { timeout: 8000 })
}

const srcOf = (l: Locator) => l.locator('img').first().getAttribute('src')

async function startPick(page: Page, frame: Locator, id: 'replace' | 'place') {
  await frame.click({ button: 'right', force: true })
  await row(page, id).click()
  await expect(film(page)).toHaveAttribute('data-picking', 'true')
}

async function rect(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** The lock toggle sits in the inspector's "Position & size" section, collapsed by default. */
async function lockSelected(page: Page) {
  const section = demo(page).getByRole('button', { name: 'Position & size' })
  const lock = demo(page).getByRole('button', { name: 'Lock (Ctrl+Shift+L)' })
  await expect(section).toBeVisible()
  if (!(await lock.isVisible())) await section.click()
  await lock.click()
}

/** The resolved `--select` colour as rgb(). */
const selectRgb = (page: Page) =>
  page.evaluate(() => {
    const el = document.body.appendChild(document.createElement('i'))
    el.style.color = 'var(--select)'
    const c = getComputedStyle(el).color
    el.remove()
    return c
  })

test.beforeEach(async ({ page }) => {
  await openDemoBook(page)
})

test('Replace photo…: ring, copy cursor, tag and status; a thumb click replaces in one undo step', async ({
  page,
}) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  const before = await srcOf(f)
  await startPick(page, f, 'replace')

  // look: inset 2 px --select ring, painted on the grid's edge
  const sel = await selectRgb(page)
  const shadow = await film(page).evaluate(
    (el) => getComputedStyle(el).boxShadow,
  )
  // Tailwind 4 stacks empty ring layers first; the painted layer is the last
  expect(shadow.split(', rgb').at(-1)).toBe(
    `${sel.replace(/^rgb/, '')} 0px 0px 0px 2px inset`,
  )
  const box = await rect(film(page))
  const px = await pixelsAt(film(page), [{ x: 0.5, y: box.height / 2 }])
  const rgb = sel.match(/\d+/g)?.map(Number) ?? []
  expect(px.map((p) => p.slice(0, 3))).toEqual([rgb])
  await expect(thumb(page, 3)).toHaveCSS('cursor', 'copy')
  await expect(status(page)).toHaveText(REPLACE_STATUS)
  // tag: "Replacing", crop-tag look at the frame's top-left, 24 px above
  await expect(tag(page)).toHaveText('Replacing')
  await expect(tag(page)).toHaveCSS('font-weight', '600')
  await expect(tag(page)).toHaveCSS('line-height', '16px')
  await expect(tag(page)).toHaveCSS('border-top-left-radius', '6px')
  const fb = await rect(f)
  const tb = await rect(tag(page))
  expect(Math.abs(tb.x - fb.x)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(tb.y - (fb.y - 24))).toBeLessThanOrEqual(0.5)
  // focus went to the filmstrip's roving thumb
  await expect(film(page).locator('[role="row"]:focus')).toHaveCount(1)

  const want = await srcOf(thumb(page, 3))
  await thumb(page, 3).click()
  await expect.poll(() => srcOf(f)).toBe(want)
  await expect(film(page)).not.toHaveAttribute('data-picking', /.*/)
  await expect(tag(page)).toHaveCount(0)
  await expect(status(page)).toContainText('Replaced')
  await expect(thumb(page, 3)).not.toHaveCSS('cursor', 'copy')

  // one undo step back to thumb 5's photo, a second one empties the frame (the fill drop)
  await page.keyboard.press('Control+z')
  await expect.poll(() => srcOf(f)).toBe(before)
  await page.keyboard.press('Control+z')
  await expect(f.locator('img')).toHaveCount(0)
})

test('Enter on a focused thumb picks', async ({ page }) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  await startPick(page, f, 'replace')
  await thumb(page, 2).focus()
  const want = await srcOf(thumb(page, 2))
  await page.keyboard.press('Enter')
  await expect.poll(() => srcOf(f)).toBe(want)
  await expect(film(page)).not.toHaveAttribute('data-picking', /.*/)
})

test('Esc cancels with no change and keeps the frame selected; a press in the dock keeps the mode', async ({
  page,
}) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  const before = await srcOf(f)
  await startPick(page, f, 'replace')
  // a press inside the dock (its header) keeps the mode
  await demo(page).getByTestId('film-head').click()
  await expect(film(page)).toHaveAttribute('data-picking', 'true')

  await page.keyboard.press('Escape')
  await expect(film(page)).not.toHaveAttribute('data-picking', /.*/)
  await expect(tag(page)).toHaveCount(0)
  await expect(status(page)).toHaveText('')
  expect(await srcOf(f)).toBe(before)
  // the first Esc only ended the pick: the frame is still selected
  await expect(demo(page).getByTestId('handles')).toHaveCount(1)
  // no undo step was added: one Ctrl+Z undoes the fill drop
  await page.keyboard.press('Control+z')
  await expect(f.locator('img')).toHaveCount(0)
})

test('a press outside the dock cancels with no change', async ({ page }) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  const before = await srcOf(f)
  await startPick(page, f, 'replace')
  await hero(page).nth(2).click({ force: true })
  await expect(film(page)).not.toHaveAttribute('data-picking', /.*/)
  await expect(tag(page)).toHaveCount(0)
  await thumb(page, 3).click()
  expect(await srcOf(f)).toBe(before)
})

test('Place photo… on an empty frame places the picked photo', async ({
  page,
}) => {
  await addPhotos(page)
  const f = hero(page).nth(1)
  await startPick(page, f, 'place')
  await expect(tag(page)).toHaveText('Placing')
  await expect(status(page)).toHaveText(PLACE_STATUS)
  const want = await srcOf(thumb(page, 3))
  await thumb(page, 3).click()
  await expect.poll(() => srcOf(f)).toBe(want)
  await expect(status(page)).toContainText('Placed')
  await page.keyboard.press('Control+z')
  await expect(f.locator('img')).toHaveCount(0)
})

test('rows are disabled on a locked frame and with no photos', async ({
  page,
}) => {
  // no photos yet: Place photo… is disabled
  await hero(page).nth(1).click({ button: 'right', force: true })
  await expect(row(page, 'place')).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')

  await fillFrame0(page)
  const f = hero(page).nth(0)
  await f.click({ force: true })
  await lockSelected(page)
  await f.click({ button: 'right', force: true })
  await expect(row(page, 'replace')).toHaveAttribute('aria-disabled', 'true')
})
