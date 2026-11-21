import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Designer frame-context-menu FM1, kit `#/demo`: a right-click on a frame opens
// one fixed order of rows in groups (photo · edit · order · lock + delete);
// rows that do not apply are disabled, not hidden. A pointer open highlights
// no row, Shift+F10 focuses the first one. A right-click on the paper after a
// frame copy opens the page menu (Paste / Paste in place).

test.use({ viewport: { width: 1440, height: 900 } })

const demo = (page: Page) => page.getByTestId('demo')
// spread 4 is the sample t-hero4 layout: five empty frames, frame 0 at the back
const spreadAt = (page: Page, i: number) =>
  demo(page).locator(`[data-testid="canvas"] [data-spread="${String(i)}"]`)
const hero = (page: Page) => spreadAt(page, 4).locator('[data-testid="frame"]')
const menu = (page: Page) => page.getByTestId('frame-menu')
const items = (m: Locator) => m.getByRole('menuitem')
const row = (page: Page, id: string) => page.getByTestId(`frame-menu-${id}`)

const FILLED = [
  'Replace photo…',
  'Remove photo',
  'Fit photo to frame',
  'Crop',
  'Cut',
  'Copy',
  'Paste',
  'Duplicate',
  'Bring to front',
  'Bring forward',
  'Send backward',
  'Send to back',
  'Lock',
  'Delete frame',
]
const EDIT = ['Cut', 'Copy', 'Paste', 'Duplicate']
const ORDER = [
  'Bring to front',
  'Bring forward',
  'Send backward',
  'Send to back',
]

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

/** The photo folder, then a filmstrip photo dropped into spread 4's frame 0. */
async function fillFrame0(page: Page) {
  await demo(page).getByTestId('demo-add-folder').click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await page
    .locator('[data-testid="filmstrip"] [role="row"]')
    .nth(5)
    .dragTo(hero(page).nth(0))
  await expect(hero(page).nth(0).locator('img')).toHaveCount(1)
  await page.mouse.move(5, 5)
}

async function rightClick(l: Locator) {
  await l.click({ button: 'right', force: true })
}

/** Labels without the key column. */
async function labels(m: Locator) {
  const all = await items(m).evaluateAll((els) =>
    els.map((e) =>
      [...e.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim(),
    ),
  )
  return all
}

async function disabled(m: Locator) {
  return items(m).evaluateAll((els) =>
    els
      .filter((e) => e.getAttribute('aria-disabled') === 'true')
      .map((e) => e.getAttribute('data-testid')),
  )
}

async function rect(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** The menu's popover box once its entry animation (zoom-in) has finished. */
async function popover(m: Locator) {
  const pop = m.locator('..')
  await pop.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  return rect(pop)
}

/** The lock toggle sits in the inspector's "Position & size" section, collapsed by default. */
async function lockSelected(page: Page) {
  const section = demo(page).getByRole('button', { name: 'Position & size' })
  const lock = demo(page).getByRole('button', { name: 'Lock (Ctrl+Shift+L)' })
  await expect(section).toBeVisible()
  if (!(await lock.isVisible())) await section.click()
  await lock.click()
}

test.beforeEach(async ({ page }) => {
  await openDemoBook(page)
})

test('filled photo frame: 14 rows, 3 separators, 224 × 468.81 px, painted at the pointer, no row focused', async ({
  page,
}) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  const b = await rect(f)
  const at = { x: Math.round(b.x + 20), y: Math.round(b.y + 20) }
  await page.mouse.click(at.x, at.y, { button: 'right' })
  const m = menu(page)
  await expect(m).toBeVisible()
  expect(await labels(m)).toEqual(FILLED)
  await expect(m.getByRole('separator')).toHaveCount(3)
  // frame 0 is at the back: the Send rows are greyed; nothing copied yet: Paste too
  expect(await disabled(m)).toEqual([
    'frame-menu-paste',
    'frame-menu-backward',
    'frame-menu-back',
  ])
  await expect(row(page, 'cut')).toContainText('Ctrl+X')
  await expect(row(page, 'front')).toContainText('Shift+Ctrl+]')
  await expect(row(page, 'lock')).toContainText('Ctrl+Shift+L')
  await expect(row(page, 'delete')).toContainText('Del')
  // M5: a pointer open highlights no row
  await expect(m.locator('[data-focused]')).toHaveCount(0)
  const pop = await popover(m)
  expect(Math.abs(pop.width - 224)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(pop.height - 468.81)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(pop.x - at.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(pop.y - at.y)).toBeLessThanOrEqual(10)
  // paint: the first row is the topmost element under its own centre
  const r1 = await rect(row(page, 'replace'))
  const top = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-testid]')
        ?.getAttribute('data-testid'),
    { x: r1.x + r1.width / 2, y: r1.y + r1.height / 2 },
  )
  expect(top).toBe('frame-menu-replace')
})

test('Fit ↔ Fill flips the row label; Remove photo empties the frame', async ({
  page,
}) => {
  await fillFrame0(page)
  await rightClick(hero(page).nth(0))
  await row(page, 'fit').click()
  await expect(menu(page)).toHaveCount(0)
  await rightClick(hero(page).nth(0))
  await expect(row(page, 'fit')).toHaveText('Fill frame')
  await row(page, 'remove').click()
  await expect(hero(page).nth(0).locator('img')).toHaveCount(0)
  await rightClick(hero(page).nth(0))
  await expect(row(page, 'place')).toBeVisible()
})

test('empty frame: Place photo…, edit, order, Lock + Delete', async ({
  page,
}) => {
  await rightClick(hero(page).nth(4))
  const m = menu(page)
  expect(await labels(m)).toEqual([
    'Place photo…',
    ...EDIT,
    ...ORDER,
    'Lock',
    'Delete frame',
  ])
  await expect(m.getByRole('separator')).toHaveCount(3)
  // frame 4 is on top; no photos yet, so Place photo… is disabled (M2: a pick needs ≥ 1 photo)
  expect(await disabled(m)).toEqual([
    'frame-menu-place',
    'frame-menu-paste',
    'frame-menu-front',
    'frame-menu-forward',
  ])
  // Bring to back via the menu: one step, the frame goes to the back
  await row(page, 'back').click()
  await rightClick(hero(page).nth(0))
  expect(await disabled(menu(page))).toEqual([
    'frame-menu-place',
    'frame-menu-paste',
    'frame-menu-backward',
    'frame-menu-back',
  ])
})

test('locked frame: Replace photo… and Cut are disabled; Unlock', async ({
  page,
}) => {
  await fillFrame0(page)
  await hero(page).nth(0).click({ force: true })
  await lockSelected(page)
  await rightClick(hero(page).nth(0))
  const m = menu(page)
  expect(await disabled(m)).toEqual([
    'frame-menu-replace',
    'frame-menu-cut',
    'frame-menu-paste',
    'frame-menu-backward',
    'frame-menu-back',
  ])
  await expect(row(page, 'lock')).toContainText('Unlock')
  await expect(row(page, 'delete')).toBeEnabled()
})

test('text frame: edit, order, Lock + Delete', async ({ page }) => {
  await hero(page).nth(0).click({ force: true })
  await demo(page).locator('[aria-label="Text (T)"]').click()
  const b = await rect(hero(page).nth(0))
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await expect(hero(page)).toHaveCount(6)
  await page.keyboard.type('Hi')
  await page.keyboard.press('Escape')
  await expect(hero(page)).toHaveCount(6)
  await rightClick(hero(page).nth(5))
  expect(await labels(menu(page))).toEqual([
    ...EDIT,
    ...ORDER,
    'Lock',
    'Delete frame',
  ])
})

test('multi-selection: the right-click keeps the set; Delete 2 frames', async ({
  page,
}) => {
  await hero(page).nth(1).click({ force: true })
  await hero(page)
    .nth(2)
    .click({ force: true, modifiers: ['Shift'] })
  await rightClick(hero(page).nth(2))
  expect(await labels(menu(page))).toEqual([
    ...EDIT,
    ...ORDER,
    'Lock',
    'Delete 2 frames',
  ])
  await row(page, 'delete').click()
  await expect(hero(page)).toHaveCount(3)
  await page.keyboard.press('Control+z')
  await expect(hero(page)).toHaveCount(5)
})

test('override copy: Reset / Hide, edit, Lock; no order rows, no Delete', async ({
  page,
}) => {
  const cur = demo(page).locator(
    '[data-testid="canvas"] [data-testid="spread"][data-current]',
  )
  await demo(page).locator('[data-item="p1"]').click()
  const chapter = cur.locator(
    '[data-testid="master-frame"][data-frame="mA-ch"]',
  )
  await expect(chapter).toHaveCount(1)
  const b = await rect(chapter)
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  const copy = cur.locator('[data-override="true"]')
  await expect(copy).toHaveCount(1)
  await rightClick(copy)
  const m = menu(page)
  const got = await labels(m)
  expect(got.slice(0, 2)).toEqual(['Reset to parent', 'Hide on this spread'])
  expect(got.slice(-5)).toEqual([...EDIT, 'Lock'])
  expect(got).not.toContain('Bring to front')
  expect(got.some((l) => l.startsWith('Delete'))).toBe(false)
  await row(page, 'reset-parent').click()
  await expect(copy).toHaveCount(0)
})

test('Shift+F10 opens the menu on the selection with row 1 focused', async ({
  page,
}) => {
  await hero(page).nth(4).click({ force: true })
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  // the first enabled row: Place photo… is disabled with no photos (M2)
  await expect(row(page, 'cut')).toHaveAttribute('data-focused', 'true')
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
})

test('menu Copy, then the page menu Paste adds the frame; no page menu before a copy', async ({
  page,
}) => {
  // a frame click scrolls spread 4 into view and makes it current; Esc drops the selection
  await hero(page).nth(1).click({ force: true })
  await page.keyboard.press('Escape')
  const p = await rect(spreadAt(page, 4))
  // the paper corner holds no frame: nothing copied yet, the browser menu stays
  await page.mouse.click(p.x + 3, p.y + 3, { button: 'right' })
  await expect(page.getByTestId('page-menu')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await rightClick(hero(page).nth(1))
  await row(page, 'copy').click()
  await expect(demo(page).getByTestId('status')).toHaveText('Copied frame')
  await page.mouse.click(p.x + 3, p.y + 3, { button: 'right' })
  const pm = page.getByTestId('page-menu')
  await expect(pm).toBeVisible()
  expect(await labels(pm)).toEqual(['Paste', 'Paste in place'])
  await page.getByTestId('page-menu-paste').click()
  await expect(hero(page)).toHaveCount(6)
  // the frame menu Paste is enabled now and pastes on the same spread
  await rightClick(hero(page).nth(0))
  await expect(row(page, 'paste')).not.toHaveAttribute('aria-disabled', 'true')
  await row(page, 'paste').click()
  await expect(hero(page)).toHaveCount(7)
})

test('opened at y 840 the menu stays inside the 1440 × 900 window', async ({
  page,
}) => {
  await fillFrame0(page)
  const f = hero(page).nth(0)
  const b = await rect(f)
  await f.dispatchEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: Math.round(b.x + 20),
    clientY: 840,
  })
  await expect(menu(page)).toBeVisible()
  const r = await popover(menu(page))
  expect(Math.abs(r.height - 468.81)).toBeLessThanOrEqual(0.5)
  expect(r.y).toBeGreaterThanOrEqual(0)
  expect(r.y + r.height).toBeLessThanOrEqual(900)
})

test('macOS: the key column shows glyphs, ⇧ before ⌘, no "+"', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
  })
  // the same #/demo URL is a hash navigation: reload so the kit reads the platform again
  await page.reload()
  await openDemoBook(page)
  await rightClick(hero(page).nth(4))
  await expect(row(page, 'cut').locator('kbd')).toHaveText('⌘X')
  await expect(row(page, 'back').locator('kbd')).toHaveText('⇧⌘[')
  await expect(row(page, 'lock').locator('kbd')).toHaveText('⇧⌘L')
  await expect(row(page, 'delete').locator('kbd')).toHaveText('⌫')
})
