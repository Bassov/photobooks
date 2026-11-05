import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { chooseZoom } from './fixtures/zoomMenu'

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('locator has no box')
  }
  return box
}

// parent-overrides-canvas: `&parent=a` puts Master A (one logo in the top
// margin, 24 × 8 mm) on all 40 painter spreads; nothing paints over it.
const canvasSpread = (page: Page, id: string) =>
  page.locator(`[data-testid="spread-view"][data-spread-id="${id}"]`)
const parentLayer = (page: Page, id: string) =>
  canvasSpread(page, id).getByTestId('parent-layer')
const inheritedLogo = (page: Page, id: string) =>
  parentLayer(page, id).locator('[data-parent-item="true"]')
const copyOf = (page: Page, id: string) =>
  parentLayer(page, id).locator('button.spread-frame[data-override="true"]')
const badge = (copy: Locator) => copy.getByTestId('override-badge')
/** A selected copy's ring + handles, painted above the own frames. */
const selectionOf = (page: Page, id: string) =>
  canvasSpread(page, id).getByTestId('copy-selection')

/**
 * Ctrl+wheel steps of `deltaY` over the copy, one per frame (well inside the
 * 80 ms settle), until its live height crosses `heightPx`; returns the live
 * copy box and badge state before the zoom settles.
 */
async function liveZoomUntil(page: Page, deltaY: number, heightPx: number) {
  return page.evaluate(
    async ([step, limit]) => {
      const badgeEl = document.querySelector<HTMLElement>(
        '[data-override="true"] [data-testid="override-badge"]',
      )
      const port = document.querySelector('[data-testid="pasteboard-scroll"]')
      const copyEl = badgeEl?.closest('button')
      if (!badgeEl || !port || !copyEl) {
        throw new Error('expected a copy with a badge')
      }
      const frame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve))
      const crossed = () => {
        const { height } = copyEl.getBoundingClientRect()
        return step > 0 ? height < limit : height >= limit
      }
      for (let index = 0; index < 40 && !crossed(); index += 1) {
        const at = copyEl.getBoundingClientRect()
        port.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: step,
            ctrlKey: true,
            clientX: at.x,
            clientY: at.y,
            bubbles: true,
            cancelable: true,
          }),
        )
        await frame()
      }
      const live = copyEl.getBoundingClientRect()
      const text = badgeEl.querySelector('.spread-frame-override-text')
      return {
        width: live.width,
        height: live.height,
        fit: badgeEl.dataset.liveFit,
        display: getComputedStyle(badgeEl).display,
        text: text === null ? null : getComputedStyle(text).display,
      }
    },
    [deltaY, heightPx] as const,
  )
}

async function openSpread(page: Page, id: string) {
  await page.getByTestId(`spread-list-item-${id}`).click()
  await expect(inheritedLogo(page, id)).toBeVisible()
}

/** Ctrl+Shift press at the box centre, then an Alt (no snap) drag by `dx`. */
async function overrideDrag(page: Page, target: Locator, dx: number) {
  const box = await boxOf(target)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  if (dx !== 0) {
    await page.keyboard.down('Alt')
    await page.mouse.move(x + dx, y, { steps: 6 })
    await page.keyboard.up('Alt')
  }
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=painter&parent=a')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
})

test('Ctrl+Shift through an own frame overrides the logo and moves the copy; undo twice restores it', async ({
  page,
}) => {
  const a = 'painter-spread-1'
  await openSpread(page, a)
  const logo = inheritedLogo(page, a)
  // Empty → marked: the inherited logo wears the dashed --parent-soft outline.
  const outline = await logo.evaluate((el) => {
    const after = getComputedStyle(el, '::after')
    return `${after.outlineStyle} ${after.outlineWidth} ${after.outlineColor}`
  })
  expect(outline).toBe('dashed 1px rgb(163, 161, 162)')
  await expect(copyOf(page, a)).toHaveCount(0)

  // A plain click on the uncovered logo selects nothing and announces the key.
  const logoBox = await boxOf(logo)
  await page.mouse.click(
    logoBox.x + logoBox.width / 2,
    logoBox.y + logoBox.height / 2,
  )
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Parent item from “Master A”. Ctrl+Shift+click to override it on this spread.',
  )
  await expect(
    page.locator('button.spread-frame[aria-pressed="true"]'),
  ).toHaveCount(0)

  // An own frame drawn from the logo's bottom-left up past the paper top
  // (clamped to it) covers the logo's centre.
  const paper = await boxOf(canvasSpread(page, a))
  await page.keyboard.press('f')
  await page.mouse.move(logoBox.x + 2, logoBox.y + logoBox.height - 1)
  await page.mouse.down()
  await page.mouse.move(logoBox.x + logoBox.width + 40, paper.y - 20, {
    steps: 6,
  })
  await page.mouse.up()
  const drawn = canvasSpread(page, a).locator(
    'button.spread-frame:not([data-override])[aria-pressed="true"]',
  )
  await expect(drawn).toHaveCount(1)
  const ownId = await drawn.getAttribute('data-frame-id')
  const own = canvasSpread(page, a).locator(
    `button.spread-frame[data-frame-id="${ownId ?? ''}"]`,
  )
  const ownBox = await boxOf(own)
  const coveredBy = await page.evaluate(
    ([x, y]) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.spread-frame')
        ?.getAttribute('data-frame-id'),
    [logoBox.x + logoBox.width / 2, logoBox.y + logoBox.height / 2] as const,
  )
  expect(coveredBy).toBe(ownId)

  // Interact: Ctrl+Shift press through the own frame, drag 30 px right.
  await overrideDrag(page, logo, 30)
  const copy = copyOf(page, a)
  await expect(copy).toHaveCount(1)
  await expect(inheritedLogo(page, a)).toHaveCount(0)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  await expect(copy).toHaveAttribute('data-filled', 'true')
  await expect
    .poll(async () => (await boxOf(copy)).x - logoBox.x)
    .toBeCloseTo(30, 0)
  expect(await boxOf(own)).toEqual(ownBox)
  // Still painted under the own frame: the topmost frame at the press point
  // is the own frame (the copy's handles above it may cover the point).
  const top = await page.evaluate(
    ([x, y]) =>
      document
        .elementsFromPoint(x, y)
        .find((el) => el.matches('.spread-frame'))
        ?.getAttribute('data-frame-id'),
    [
      logoBox.x + logoBox.width / 2 + 30,
      logoBox.y + logoBox.height / 2,
    ] as const,
  )
  expect(top).toBe(ownId)
  // …but its ring and 8 handles sit above the own frame, grabbable.
  const chrome = selectionOf(page, a)
  expect(await boxOf(chrome)).toEqual(await boxOf(copy))
  const handles = chrome.locator('[data-handle]')
  await expect(handles).toHaveCount(8)
  for (const handle of await handles.all()) {
    const box = await boxOf(handle)
    const hit = await page.evaluate(
      ([x, y]) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[data-handle]')
          ?.closest('[data-selection-for]')
          ?.getAttribute('data-selection-for'),
      [box.x + box.width / 2, box.y + box.height / 2] as const,
    )
    expect(hit).toBe(await copy.getAttribute('data-frame-id'))
  }

  // Undo: the move, then the override.
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await boxOf(copy)).x).toBeCloseTo(logoBox.x, 0)
  await page.keyboard.press('Control+z')
  await expect(copyOf(page, a)).toHaveCount(0)
  await expect(inheritedLogo(page, a)).toHaveCount(1)
  await assertDocumentFitsViewport(page)
})

test('the override badge shows in full, icon-only, or not at all by the copy size', async ({
  page,
}) => {
  const b = 'painter-spread-2'
  await openSpread(page, b)
  await chooseZoom(page, '100%')
  await inheritedLogo(page, b).scrollIntoViewIfNeeded()
  await overrideDrag(page, inheritedLogo(page, b), 0)
  const copy = copyOf(page, b)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')

  // 100 %: 24 × 8 mm ≈ 91 × 30 px → the full badge (kit 66.42 × 16.84).
  const full = await boxOf(badge(copy))
  await expect(badge(copy)).toHaveAttribute('data-fit', 'full')
  await expect(badge(copy)).toHaveText('override')
  expect(Math.abs(full.height - 16.85)).toBeLessThanOrEqual(0.5)
  expect(full.width).toBeGreaterThan(55)
  expect(full.width).toBeLessThan(75)
  let copyBox = await boxOf(copy)
  expect(full.x - copyBox.x).toBeCloseTo(4, 0)
  expect(full.y - copyBox.y).toBeCloseTo(4, 0)

  // Live Ctrl+wheel zoom-out: the badge refits per gesture frame; under
  // 24.84 px high it goes, and the live fit clears when the zoom settles.
  const out = await liveZoomUntil(page, 120, 24.84)
  expect(out.height).toBeLessThan(24.84)
  expect(out).toMatchObject({ fit: 'none', display: 'none' })
  await expect(badge(copy)).not.toHaveAttribute('data-live-fit')
  await chooseZoom(page, '100%')
  await copy.scrollIntoViewIfNeeded()
  await expect(badge(copy)).toHaveAttribute('data-fit', 'full')
  copyBox = await boxOf(copy)

  // Narrowed to ~40 px with a handle above the frames (snaps may shift it)
  // → icon only.
  const east = await boxOf(selectionOf(page, b).locator('[data-handle="e"]'))
  await page.mouse.move(east.x + east.width / 2, east.y + east.height / 2)
  await page.mouse.down()
  await page.mouse.move(copyBox.x + 40, east.y + east.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect
    .poll(async () => (await boxOf(copy)).width)
    .toBeLessThan(copyBox.width - 20)
  const narrow = await boxOf(copy)
  expect(narrow.width).toBeGreaterThanOrEqual(26)
  expect(narrow.width).toBeLessThan(50)
  await expect(badge(copy)).toHaveAttribute('data-fit', 'icon')
  await expect(badge(copy)).toHaveAttribute('aria-label', 'Override')
  const icon = await boxOf(badge(copy))
  expect(Math.abs(icon.width - 18)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(icon.height - 16.85)).toBeLessThanOrEqual(0.5)

  // 50 %: under 25 × 15 px → no badge.
  // `chooseZoom` matches "150%" too; pick the exact row.
  await page.getByTestId('zoom-menu').click()
  await page.getByRole('menuitem', { name: '50%', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect
    .poll(async () => (await boxOf(copy)).height)
    .toBeLessThan(full.height)
  await expect(badge(copy)).toHaveAttribute('data-fit', 'none')
  await expect(badge(copy)).toBeHidden()

  // Live zoom-in: tall enough again → the icon, text still hidden.
  const back = await liveZoomUntil(page, -120, 24.84)
  expect(back.height).toBeGreaterThanOrEqual(24.84)
  expect(back.width).toBeGreaterThanOrEqual(26)
  expect(back.width).toBeLessThan(74.42)
  expect(back).toMatchObject({
    fit: 'icon',
    // inline-flex, blockified by position: absolute.
    display: 'flex',
    text: 'none',
  })
  await assertDocumentFitsViewport(page)
})

test('a handle drag on a selected copy keeps it selected, the ring tracks, Delete then takes its photo', async ({
  page,
}) => {
  const c = 'painter-spread-3'
  await openSpread(page, c)
  await overrideDrag(page, inheritedLogo(page, c), 0)
  const copy = copyOf(page, c)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  const chrome = selectionOf(page, c)
  const box0 = await boxOf(copy)

  // Interact: the copy's `se` handle (above the frames) +30, +20 (Alt would
  // resize from the centre; snaps may shift an edge); every sampled step keeps
  // the selection and the ring on the live copy.
  const se = await boxOf(chrome.locator('[data-handle="se"]'))
  const x = se.x + se.width / 2
  const y = se.y + se.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  await expect(chrome).toBeVisible()
  let width = box0.width
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(x + (30 * step) / 4, y + (20 * step) / 4)
    await expect(copy).toHaveAttribute('aria-pressed', 'true')
    const live = await boxOf(copy)
    expect(live.width).toBeGreaterThan(width)
    width = live.width
    expect(await boxOf(chrome)).toEqual(live)
  }
  await page.mouse.up()
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  const after = await boxOf(copy)
  expect(after.width - box0.width).toBeGreaterThan(20)
  expect(after.height - box0.height).toBeGreaterThan(10)
  expect(await boxOf(chrome)).toEqual(after)

  // Delete takes the photo like on an own frame, never the spread.
  await page.keyboard.press('Delete')
  await expect(copy).toHaveAttribute('data-filled', 'false')
  await expect(copy).toBeFocused()
  await expect(inheritedLogo(page, c)).toHaveCount(0)
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  await assertDocumentFitsViewport(page)
})

// parent-overrides-inspector (Designer PO4, PO6, PO7).
async function rightClickCentre(page: Page, target: Locator) {
  const box = await boxOf(target)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    button: 'right',
  })
}

const parentChanges = (page: Page) => page.getByTestId('parent-changes')
const changeRows = (page: Page) => page.getByTestId('parent-change-row')

test('the parent menu overrides and hides the logo; the head ↺ and a row ↺ restore it', async ({
  page,
}) => {
  const a = 'painter-spread-2'
  await openSpread(page, a)
  // Empty: a spread that only inherits shows no changes list.
  await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
  await expect(page.getByTestId('spread-spacing')).toBeVisible()
  await expect(parentChanges(page)).toHaveCount(0)
  const logo = inheritedLogo(page, a)
  const logoBox = await boxOf(logo)

  // Happy: right-click → Override on this spread → the copy is selected.
  await rightClickCentre(page, logo)
  const menu = page.getByTestId('parent-menu')
  await expect(menu).toHaveAttribute('aria-label', 'Parent item')
  await expect(menu.getByRole('menuitem')).toHaveText([
    /^Override on this spread(Ctrl\+Shift\+Click|⌘⇧Click)$/,
    'Hide on this spread',
  ])
  await page.getByTestId('parent-menu-override').click()
  const copy = copyOf(page, a)
  await expect(copy).toHaveCount(1)
  await expect(copy).toHaveAttribute('aria-pressed', 'true')
  await expect(inheritedLogo(page, a)).toHaveCount(0)
  expect(await boxOf(copy)).toEqual(logoBox)
  await expect(page.getByTestId('inspector-override-meta')).toHaveText(
    'Override · Master A',
  )
  const reset = page.getByTestId('inspector-reset-parent')
  const resetBox = await boxOf(reset)
  expect([resetBox.width, resetBox.height]).toEqual([28, 28])

  // The head ↺ removes the copy; the inspector is back on the spread.
  await reset.click()
  await expect(copyOf(page, a)).toHaveCount(0)
  await expect(inheritedLogo(page, a)).toHaveCount(1)
  await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
  await expect(parentChanges(page)).toHaveCount(0)

  // Interact: Hide on this spread → listed as hidden; its ↺ brings it back.
  await rightClickCentre(page, inheritedLogo(page, a))
  await page.getByTestId('parent-menu-hide').click()
  await expect(inheritedLogo(page, a)).toHaveCount(0)
  await expect(parentChanges(page)).toContainText('Changed from Master A')
  await expect(changeRows(page)).toHaveText(['Photo frame· hidden'])
  const row = await boxOf(changeRows(page))
  expect(row.height).toBe(28)
  await page
    .getByRole('button', { name: 'Reset Photo frame to Master A' })
    .click()
  await expect(inheritedLogo(page, a)).toHaveCount(1)
  expect(await boxOf(inheritedLogo(page, a))).toEqual(logoBox)
  await expect(parentChanges(page)).toHaveCount(0)
  // Other spreads never changed.
  await openSpread(page, 'painter-spread-3')
  await expect(parentChanges(page)).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('a copy menu reads Reset / Hide / Lock; Reset all restores the moved logo', async ({
  page,
}) => {
  const a = 'painter-spread-2'
  await openSpread(page, a)
  const logoBox = await boxOf(inheritedLogo(page, a))
  await overrideDrag(page, inheritedLogo(page, a), 30)
  const copy = copyOf(page, a)
  await expect
    .poll(async () => (await boxOf(copy)).x - logoBox.x)
    .toBeCloseTo(30, 0)

  await rightClickCentre(page, copy)
  await expect(page.getByTestId('frame-menu').getByRole('menuitem')).toHaveText(
    ['Reset to parent', 'Hide on this spread', /^Lock/],
  )
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('frame-menu')).toHaveCount(0)

  // The spread inspector lists the override; Reset all puts the logo back.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
  await expect(changeRows(page)).toHaveText(['Photo frame· override'])
  await page.getByTestId('parent-reset-all').click()
  await expect(copyOf(page, a)).toHaveCount(0)
  expect(await boxOf(inheritedLogo(page, a))).toEqual(logoBox)
  await expect(parentChanges(page)).toHaveCount(0)

  // Hide from the copy menu: neither copy nor logo; Reset all again.
  await overrideDrag(page, inheritedLogo(page, a), 0)
  await rightClickCentre(page, copyOf(page, a))
  await page.getByTestId('frame-menu-hide-parent').click()
  await expect(copyOf(page, a)).toHaveCount(0)
  await expect(inheritedLogo(page, a)).toHaveCount(0)
  await expect(changeRows(page)).toHaveText(['Photo frame· hidden'])
  await page.getByTestId('parent-reset-all').click()
  await expect(inheritedLogo(page, a)).toHaveCount(1)
  await expect(parentChanges(page)).toHaveCount(0)
})
