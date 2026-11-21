import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// Designer placed-badge PB1, kit `#/demo`: the filmstrip "placed" badge is the
// "Show in the book" button. A click goes to the photo's place and selects it
// (the filmstrip row is not selected); with 2+ places it shows the count and
// each click goes to the next place, with a `Placed i of n · <label>` pill.
// Enter on a placed row = the badge; in photo-pick mode the press is the pick.

test.use({ viewport: { width: 1440, height: 900 } })

const demo = (page: Page) => page.getByTestId('demo')
const film = (page: Page) => demo(page).getByTestId('filmstrip')
const thumb = (page: Page, i: number) =>
  film(page).locator('[role="row"]').nth(i)
const badge = (row: Locator) => row.getByTestId('filmstrip-placed')
const status = (page: Page) => demo(page).getByTestId('status')
const frames = (page: Page, si: number) =>
  demo(page).locator(
    `[data-testid="canvas"] [data-spread="${String(si)}"] [data-testid="frame"]`,
  )
const listItem = (page: Page, key: string) =>
  demo(page).locator(`[data-testid="list"] [data-item="${key}"]`)

async function rect(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

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
  await demo(page).getByTestId('demo-add-folder').click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

/** Thumb 5 dropped on spread `si`'s first frame (the drop makes `si` current). */
async function placeOn(page: Page, si: number) {
  await listItem(page, `p${String(si)}`).click()
  await thumb(page, 5).dragTo(frames(page, si).first())
  await expect(frames(page, si).first().locator('img')).toHaveCount(1)
  await page.mouse.move(5, 5)
}

/** The active spread is `si` and exactly its first frame carries the handles. */
async function expectFrameSelected(page: Page, si: number) {
  await expect(listItem(page, `p${String(si)}`)).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const handles = demo(page).getByTestId('handles')
  await expect(handles).toHaveCount(1)
  const [h, f] = [await rect(handles), await rect(frames(page, si).first())]
  expect(Math.abs(h.x - f.x)).toBeLessThan(1.5)
  expect(Math.abs(h.y - f.y)).toBeLessThan(1.5)
}

test.beforeEach(async ({ page }) => {
  await openDemoBook(page)
})

test('badge: 16 × 16 at right 4 / bottom 4, check 10, 24 × 24 hit area; 2 places = ✓ 2', async ({
  page,
}) => {
  await placeOn(page, 1)
  const row = thumb(page, 5)
  const b = badge(row)
  await expect(b).toHaveCount(1)
  await expect(b).toHaveAttribute('title', 'Show in the book')
  await expect(b).toHaveAttribute('aria-label', 'Show in the book')
  await expect(b).toHaveAttribute('tabindex', '-1')
  const photo = row.locator('img').first()
  const [p, r] = [await rect(photo), await rect(b)]
  expect(p.height).toBe(76)
  expect(r.width).toBeCloseTo(16, 0)
  expect(r.height).toBeCloseTo(16, 0)
  expect(p.x + p.width - (r.x + r.width)).toBeCloseTo(4, 0)
  expect(p.y + p.height - (r.y + r.height)).toBeCloseTo(4, 0)
  const check = await rect(b.locator('svg'))
  expect(check.width).toBeCloseTo(10, 0)
  expect(check.height).toBeCloseTo(10, 0)
  // the 24 × 24 hit area (4 px around the disc) reaches the photo's right /
  // bottom edge; the very corner is the row's rounded clip
  const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2]
  const pts = [
    { x: r.x + r.width + 3.5, y: cy },
    { x: cx, y: r.y + r.height + 3.5 },
    { x: r.x - 3.5, y: cy },
    { x: cx, y: r.y - 3.5 },
    { x: r.x - 5, y: cy },
  ]
  const hits = await page.evaluate(
    (pts) =>
      pts.map(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-testid="filmstrip-placed"]') != null,
      ),
    pts,
  )
  expect(hits).toEqual([true, true, true, true, false])

  await placeOn(page, 2)
  await expect(b).toHaveText('2')
  await expect(b).toHaveAttribute(
    'aria-label',
    'Show in the book, placed 2 times',
  )
  expect((await rect(b)).width).toBeGreaterThan(22.5)
  expect((await rect(b)).width).toBeLessThan(25.5)
})

test('hover paints the badge rgb(0 0 0/.8): darker than at rest', async ({
  page,
}) => {
  await placeOn(page, 1)
  const b = badge(thumb(page, 5))
  // left of the check, inside the disc
  const at = async () => {
    const r = await rect(b)
    return [{ x: Math.round(r.width * 0.15), y: Math.round(r.height / 2) }]
  }
  const rgb = async () => ((await pixelsAt(b, await at()))[0] ?? []).slice(0, 3)
  const sum = (c: number[]) => c.reduce((a, v) => a + v, 0)
  const rest = await rgb()
  await b.hover()
  await expect
    .poll(async () => (await rect(b)).width, { timeout: 2000 })
    .toBeCloseTo(18, 0)
  const hover = await rgb()
  // .8 black over the photo leaves at most 20 % of it (≤ 51); at rest 45 % shows
  expect(hover).toHaveLength(3)
  for (const c of hover) expect(c).toBeLessThanOrEqual(52)
  expect(sum(hover)).toBeLessThan(sum(rest))
})

test('click jumps to the place; 2 places cycle with the pill, cleared after 2.5 s', async ({
  page,
}) => {
  await placeOn(page, 1)
  await placeOn(page, 2)
  await listItem(page, 'p0').click()
  const row = thumb(page, 5)
  await badge(row).click()
  await expectFrameSelected(page, 1)
  await expect(row).toHaveAttribute('aria-selected', 'false')
  await expect(status(page)).toHaveText('Placed 1 of 2 · Pages 2–3')

  await badge(row).click()
  await expectFrameSelected(page, 2)
  await expect(status(page)).toHaveText('Placed 2 of 2 · Pages 4–5')
  await expect(status(page)).toBeVisible()
  await expect(row).toHaveAttribute('aria-selected', 'false')
  await expect(status(page)).toHaveText('', { timeout: 4000 })

  // wraps after the last place
  await badge(row).click()
  await expectFrameSelected(page, 1)
  await expect(status(page)).toHaveText('Placed 1 of 2 · Pages 2–3')
})

test('one place: no pill, the status is for screen readers only', async ({
  page,
}) => {
  await placeOn(page, 1)
  await expect(status(page)).toHaveText('', { timeout: 8000 })
  await listItem(page, 'p0').click()
  await badge(thumb(page, 5)).click()
  await expectFrameSelected(page, 1)
  await expect(status(page)).toHaveText('Placed on Pages 2–3')
  const box = await rect(status(page))
  expect(box.width).toBeLessThanOrEqual(1)
})

test('Enter on a focused placed row = the badge, focus stays; unplaced row: nothing', async ({
  page,
}) => {
  await placeOn(page, 1)
  await placeOn(page, 2)
  await listItem(page, 'p0').click()
  const row = thumb(page, 5)
  await row.focus()
  await page.keyboard.press('Enter')
  await expectFrameSelected(page, 1)
  await expect(row).toBeFocused()
  await page.keyboard.press('Enter')
  await expectFrameSelected(page, 2)
  await expect(row).toBeFocused()
  await expect(status(page)).toHaveText('Placed 2 of 2 · Pages 4–5')

  await listItem(page, 'p0').click()
  const free = thumb(page, 4)
  await expect(badge(free)).toHaveCount(0)
  await free.focus()
  await page.keyboard.press('Enter')
  await expect(listItem(page, 'p0')).toHaveAttribute('aria-selected', 'true')
  await expect(demo(page).getByTestId('handles')).toHaveCount(0)
})

test('photo-pick mode: a badge press is the pick, no jump', async ({
  page,
}) => {
  await placeOn(page, 1)
  const target = frames(page, 4).first()
  await listItem(page, 'p4').click()
  await target.click({ button: 'right', force: true })
  await page.getByTestId('frame-menu-place').click()
  await expect(film(page)).toHaveAttribute('data-picking', 'true')
  await expect(badge(thumb(page, 5))).toHaveCSS('cursor', 'copy')
  await badge(thumb(page, 5)).click()
  await expect(film(page)).not.toHaveAttribute('data-picking')
  await expect(target.locator('img')).toHaveCount(1)
  await expectFrameSelected(page, 4)
  await expect(badge(thumb(page, 5))).toHaveText('2')
})

// Designer M146: after the jump each axis is revealed on its own — a frame that
// fits the port (the pasteboard right of the spread list) inset by 24 px
// scrolls the minimum that puts it inside; a larger one is centred.
test('M146: at 200 % a jump reveals a frame hidden under the spread list (fits: minimum scroll; larger: centred)', async ({
  page,
}) => {
  const pb = demo(page).getByTestId('pasteboard')
  const edge = async () => {
    const p = await rect(demo(page).getByTestId('spreads-panel'))
    return p.x + p.width
  }
  const scrollLeft = () => pb.evaluate((el) => el.scrollLeft)
  // the leftmost of spread 4's frames that still fits the port at 200 %
  await listItem(page, 'p4').click()
  const port0 = await rect(pb)
  const boxes = await Promise.all(
    (await frames(page, 4).all()).map((l) => rect(l)),
  )
  const fits = boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.width * 2 < port0.width - 48 - 2)
  expect(fits.length).toBeGreaterThan(0)
  const small = frames(page, 4).nth(
    fits.reduce((a, c) => (c.b.x < a.b.x ? c : a)).i,
  )
  await thumb(page, 5).dragTo(small)
  await expect(small.locator('img')).toHaveCount(1)
  // a full-page frame: larger than the port at 200 %
  await listItem(page, 'p1').click()
  const big = frames(page, 1).first()
  await thumb(page, 6).dragTo(big)
  await expect(big.locator('img')).toHaveCount(1)
  await page.mouse.move(5, 5)
  await listItem(page, 'p4').click()
  await demo(page).getByTestId('zoom-menu').click()
  await page.getByRole('menuitem', { name: '200%' }).click()

  // fits: the frame scrolled out to the left, under the spread list
  await pb.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await expect
    .poll(async () => (await rect(small)).x)
    .toBeLessThan(await edge())
  let before = await scrollLeft()
  await badge(thumb(page, 5)).click()
  await expect.poll(scrollLeft).not.toBe(before)
  const [port, box, left] = [await rect(pb), await rect(small), await edge()]
  expect(port.x).toBeGreaterThanOrEqual(left - 0.5)
  expect(box.x).toBeGreaterThanOrEqual(left + 24 - 0.5)
  expect(box.x).toBeCloseTo(port.x + 24, 0)
  expect(box.x + box.width).toBeLessThanOrEqual(port.x + port.width - 24 + 0.5)
  // painted there: the frame is the top hit just inside the inset
  const hit = await topAt(pb, {
    x: box.x - port.x + 12,
    y: box.y - port.y + box.height * 0.3,
  })
  expect(hit.flat()).toContain('frame')
  expect(hit.flat()).not.toContain('spreads-panel')

  // larger than the port: centred on that axis
  await pb.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  before = await scrollLeft()
  await badge(thumb(page, 6)).click()
  await expectFrameSelected(page, 1)
  await expect.poll(scrollLeft).not.toBe(before)
  const b = await rect(big)
  expect(b.width).toBeGreaterThan(port.width - 48)
  expect(b.x + b.width / 2).toBeCloseTo(port.x + port.width / 2, 0)
})

// Spec Jump step 6 (M147): every jump path clears the filmstrip selection.
test('M147: badge click, Enter and double-click jumps leave the filmstrip unselected', async ({
  page,
}) => {
  await placeOn(page, 1)
  const row = thumb(page, 5)
  const selected = film(page).locator('[role="row"][aria-selected="true"]')

  await row.click()
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await badge(row).click()
  await expectFrameSelected(page, 1)
  await expect(selected).toHaveCount(0)

  await listItem(page, 'p0').click()
  await row.click()
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expectFrameSelected(page, 1)
  await expect(selected).toHaveCount(0)

  await listItem(page, 'p0').click()
  await row.dblclick()
  await expectFrameSelected(page, 1)
  await expect(selected).toHaveCount(0)
})

// M149, prod isStatusPillVisible: only the frame drag hint, a guide position,
// the frame clipboard and the badge cycle paint the pill; other statuses are
// screen-reader only (text kept in the live region).
test('M149: drop and pick-replace statuses are screen-reader only; the badge cycle paints the pill', async ({
  page,
}) => {
  const srOnly = async (text: RegExp) => {
    await expect(status(page)).toHaveText(text)
    await expect(status(page)).toHaveAttribute('aria-live', 'polite')
    expect((await rect(status(page))).width).toBeLessThanOrEqual(1)
  }
  await placeOn(page, 1)
  await srOnly(/^Placed IMG_\d+\.jpg$/)
  await expect(status(page)).toHaveText('', { timeout: 8000 })

  await frames(page, 1).first().click({ button: 'right', force: true })
  await page.getByTestId('frame-menu-replace').click()
  await expect(film(page)).toHaveAttribute('data-picking', 'true')
  await thumb(page, 6).click()
  await srOnly(/^Replaced IMG_\d+\.jpg — it is back in the gallery$/)

  await placeOn(page, 2)
  await placeOn(page, 3)
  await expect(status(page)).toHaveText('', { timeout: 8000 })
  await listItem(page, 'p0').click()
  await badge(thumb(page, 5)).click()
  await expect(status(page)).toHaveText(/^Placed 1 of 2 · /)
  const pill = await rect(status(page))
  expect(pill.width).toBeGreaterThan(40)
  expect((await topAt(status(page)))[0]?.[0]).toBe('status')
})
