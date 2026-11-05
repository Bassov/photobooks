import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// parent-overrides-kit (Designer parent-overrides Spec 2026-11-04 §Kit changes,
// parent-overrides-canvas review 3): on the kit `#/demo` spread 2–3 (Master A,
// one full-bleed own frame) parent items paint under own frames and let clicks
// through; Ctrl+Shift reaches them geometrically, copies keep the parent slot
// and wear the fit-rule badge; Delete / guide-to-ruler hide; the inspector
// names the changes and resets them.

const demo = (page: Page) => page.getByTestId('demo')
const current = (page: Page) =>
  demo(page).locator(
    '[data-testid="canvas"] [data-testid="spread"][data-current]',
  )
const chapter = (page: Page) =>
  current(page).locator('[data-testid="master-frame"][data-frame="mA-ch"]')
const copy = (page: Page) => current(page).locator('[data-override="true"]')
const badge = (page: Page) => copy(page).getByTestId('override-badge')
const inspector = (page: Page) => demo(page).getByTestId('ctx-inspector')
const changes = (page: Page) => inspector(page).getByTestId('parent-changes')
const rows = (page: Page) => changes(page).getByTestId('parent-change-row')

async function openSpread(page: Page) {
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
  await demo(page).locator('[data-item="p1"]').click()
  await expect(chapter(page)).toHaveCount(1)
}

/** The copy's badge against the PO3 fit rule on the measured frame: `want` from the rule, `shown` from the DOM,
 *  `inside` = not clipped by the frame, `sized` = 66.42 (full) / 18 (icon) px wide ±1.5 and 16.84 px tall; `sc` = px per mm (7 mm line). */
async function badgeState(page: Page) {
  return copy(page).evaluate((el) => {
    const f = el.getBoundingClientRect()
    const node = el.querySelector('[data-testid="override-badge"]')
    const b = node?.getBoundingClientRect()
    const want =
      f.height < 24.84
        ? 'none'
        : f.width >= 66.42 + 8
          ? 'full'
          : f.width >= 26
            ? 'icon'
            : 'none'
    const shown = node?.getAttribute('data-fit') ?? 'none'
    return {
      want,
      shown,
      inside: !b || (b.right <= f.right && b.bottom <= f.bottom),
      sized:
        !b ||
        (Math.abs(b.width - (shown === 'full' ? 66.42 : 18)) < 1.5 &&
          Math.abs(b.height - 16.84) < 0.5),
      sc: f.height / 7,
    }
  })
}

/** The spread inspector of spread 2–3 (its list row). */
async function showSpread(page: Page) {
  await demo(page).locator('[data-item="p1"]').click()
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
}

async function centre(l: Locator) {
  const b = await l.boundingBox()
  if (b === null) throw new Error('no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}

/** Ctrl+Shift press at (x, y), optionally dragged by (dx, dy) before the release. */
async function ctrlShift(
  page: Page,
  x: number,
  y: number,
  to?: { x: number; y: number },
) {
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.mouse.move(x, y)
  await page.mouse.down()
  if (to) await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
}

test('parent items paint under own frames and let a plain click through; Ctrl+Shift copies through the photo, Alt does not', async ({
  page,
}) => {
  await openSpread(page)
  const look = await chapter(page).evaluate((el) => {
    const cs = getComputedStyle(el)
    const all = [...(el.parentElement?.querySelectorAll('[data-frame]') ?? [])]
    const own = all.findIndex((x) => x.getAttribute('data-testid') === 'frame')
    return { pe: cs.pointerEvents, z: cs.zIndex, under: all.indexOf(el) < own }
  })
  expect(look).toEqual({ pe: 'none', z: 'auto', under: true })
  const p = await centre(chapter(page))
  const top = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-frame]')
        ?.getAttribute('data-testid'),
    p,
  )
  expect(top).toBe('frame')

  await chapter(page).click({ modifiers: ['Alt'], force: true })
  await expect(copy(page)).toHaveCount(0)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'photo')

  await ctrlShift(page, p.x, p.y)
  await expect(copy(page)).toHaveCount(1)
  await expect(chapter(page)).toHaveCount(0)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'text')
  await expect(
    inspector(page).getByTestId('inspector-override-meta'),
  ).toHaveText('Override · Master A')
  await expect(inspector(page).getByTestId('z-front')).toHaveCount(0)
  // the copy keeps the parent slot: before every own frame in paint order
  const order = await current(page).evaluate((sp) =>
    [...sp.querySelectorAll('[data-frame]')].map((x) =>
      x.hasAttribute('data-override') ? 'copy' : x.getAttribute('data-testid'),
    ),
  )
  expect(order.indexOf('copy')).toBeLessThan(order.indexOf('frame'))
})

test('Ctrl+Shift on a copy reselects it with no undo step and moves it after 3 px; ↺ resets it', async ({
  page,
}) => {
  await openSpread(page)
  const p = await centre(chapter(page))
  await ctrlShift(page, p.x, p.y)
  await page.keyboard.press('Escape')
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
  await ctrlShift(page, p.x, p.y)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'text')
  // one undo removes the copy: the reselect press added no step
  await page.keyboard.press('Control+z')
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(1)

  await ctrlShift(page, p.x, p.y, { x: p.x + 30, y: p.y })
  const moved = await centre(copy(page))
  expect(moved.x - p.x).toBeGreaterThan(25)
  await expect(changes(page)).toHaveCount(0) // a frame is selected: no spread inspector
  const reset = inspector(page).getByTestId('inspector-reset-parent')
  const rb = await reset.boundingBox()
  expect([rb?.width, rb?.height]).toEqual([28, 28])
  await reset.click()
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(1)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
  await expect(changes(page)).toHaveCount(0)
})

test('override badge follows the fit rule and is never clipped', async ({
  page,
}) => {
  await openSpread(page)
  const p = await centre(chapter(page))
  await ctrlShift(page, p.x, p.y)
  const ok = { inside: true, sized: true }
  // Fit: the 7 mm Chapter line is ~20 px high
  expect(await badgeState(page)).toMatchObject({
    want: 'none',
    shown: 'none',
    ...ok,
  })
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+=')
  const zoomed = await badgeState(page)
  expect(zoomed).toMatchObject({ want: 'full', shown: 'full', ...ok })
  await expect(badge(page)).toHaveText('override')
  await inspector(page).getByText('Position & size').click()
  const w = inspector(page).getByRole('textbox', { name: 'Width' })
  await w.fill(String(Math.max(5, Math.round(45 / zoomed.sc))))
  await w.press('Enter')
  expect(await badgeState(page)).toMatchObject({
    want: 'icon',
    shown: 'icon',
    ...ok,
  })
  await expect(badge(page)).toHaveAttribute('aria-label', 'Override')
})

test('Delete on a copy and a guide copy on the ruler hide; the spread lists them; ↺ and Reset all restore', async ({
  page,
}) => {
  await openSpread(page)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  await showSpread(page)
  await expect(changes(page)).toHaveCount(0) // empty: nothing changed, no block
  // the own full-bleed frame goes, so the Chapter line is uncovered: a plain click names it
  await current(page).locator('[data-testid="frame"]').first().click()
  await page.keyboard.press('Delete')
  const p = await centre(chapter(page))
  await page.mouse.click(p.x, p.y)
  await expect(demo(page).getByTestId('status')).toHaveText(
    'Parent item from “Master A”. Ctrl+Shift+click to override it on this spread.',
  )

  await ctrlShift(page, p.x, p.y)
  await page.keyboard.press('Delete')
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(0)

  const guide = current(page).locator('[data-guide="mA-gl"]')
  const g = await centre(guide)
  const ruler = await centre(demo(page).getByTestId('ruler-x'))
  await ctrlShift(page, g.x, g.y, { x: g.x, y: ruler.y })
  await expect(guide).toHaveCount(0)

  await showSpread(page)
  await expect(rows(page)).toHaveText([
    'Text “Chapter”· hidden',
    'Guide · vertical 12 mm· hidden',
  ])
  await expect(changes(page)).toContainText('Changed from Master A')
  const sizes = await changes(page).evaluate((el) => {
    const h = (s: string) => el.querySelector(s)?.getBoundingClientRect().height
    return [
      h('[data-testid="parent-reset-all"]'),
      h('[data-testid="parent-change-row"]'),
      h('[data-testid="parent-change-reset"]'),
    ]
  })
  expect(sizes).toEqual([24, 28, 16])
  // Designer kit review: the row icon sits at x 0 of the row, like prod
  const iconInset = await rows(page)
    .first()
    .evaluate(
      (row) =>
        (row.querySelector('svg')?.getBoundingClientRect().left ?? NaN) -
        row.getBoundingClientRect().left,
    )
  expect(iconInset).toBe(0)
  await rows(page).first().getByTestId('parent-change-reset').click()
  await expect(chapter(page)).toHaveCount(1)
  await expect(rows(page)).toHaveCount(1)
  await changes(page).getByTestId('parent-reset-all').click()
  await expect(changes(page)).toHaveCount(0)
  await expect(guide).toHaveCount(1)
})

test('Ctrl+Shift-drag on a parent guide makes a spread copy at the drop', async ({
  page,
}) => {
  await openSpread(page)
  // guides are dragged in the rulers' single-spread camera (the stack has none)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  const guide = current(page).locator('[data-guide="mA-gl"]')
  const g = await centre(guide)
  await ctrlShift(page, g.x, g.y, { x: g.x + 40, y: g.y })
  await expect(guide).toHaveCount(0)
  const own = current(page).locator('[data-guide]:not([data-passive])')
  await expect(own).toHaveCount(1)
  expect((await centre(own)).x - g.x).toBeGreaterThan(30)
  await showSpread(page)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('· override')
})
