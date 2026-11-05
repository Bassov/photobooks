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

test.describe('parent guides (Designer PO5)', () => {
  // `&guides=a`: Master A also has a horizontal guide at 150 mm and a
  // vertical one at 420 mm (the painter spread is 600 × 300 mm).
  const SPREAD_WIDTH_MM = 600
  const stageOf = (page: Page, id: string) =>
    page.getByTestId('spread-stage').filter({ has: canvasSpread(page, id) })
  const parentLines = (page: Page, id: string) =>
    stageOf(page, id).getByTestId('guide-line-parent')
  const copyLines = (page: Page, id: string) =>
    stageOf(page, id).locator(
      '[data-testid="guide-line"][data-layer="override"]',
    )

  async function pxPerMm(page: Page, id: string) {
    return (await boxOf(canvasSpread(page, id))).width / SPREAD_WIDTH_MM
  }

  async function ctrlShiftDrag(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await page.mouse.move(from.x, from.y)
    await page.keyboard.down('Control')
    await page.keyboard.down('Shift')
    await page.mouse.down()
    await page.keyboard.up('Shift')
    await page.keyboard.up('Control')
    await page.mouse.move(to.x, to.y, { steps: 6 })
    await page.mouse.up()
  }

  /** First bare paper point down the column at `x` (no frame or guide under it). */
  async function barePaperAt(page: Page, id: string, x: number) {
    const spread = await boxOf(canvasSpread(page, id))
    const y = await page.evaluate(
      ([px, top, bottom, spreadId]) => {
        for (let py = top + 2; py < bottom; py += 2) {
          const el = document.elementFromPoint(px, py)
          const view = el?.closest('[data-testid="spread-view"]')
          if (
            view?.getAttribute('data-spread-id') === spreadId &&
            el?.closest('.spread-frame, .guide-line') === null
          ) {
            return py
          }
        }
        return null
      },
      [x, spread.y, spread.y + spread.height, id] as const,
    )
    if (y === null) throw new Error('no bare paper')
    return { x, y }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter&parent=a&guides=a')
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '40',
    )
  })

  test('Ctrl+Shift on a parent guide through the frames overrides it on this spread and drags the copy; undo twice restores it', async ({
    page,
  }) => {
    const a = 'painter-spread-3'
    const other = 'painter-spread-4'
    await openSpread(page, a)
    // Empty: two dashed parent lines, no copy.
    await expect(parentLines(page, a)).toHaveCount(2)
    await expect(copyLines(page, a)).toHaveCount(0)
    const scale = await pxPerMm(page, a)
    const spread = await boxOf(canvasSpread(page, a))
    const line = parentLines(page, a).and(
      page.locator('[data-orientation="horizontal"]'),
    )
    const lineBox = await boxOf(line)
    const from = {
      x: spread.x + spread.width * 0.3,
      y: lineBox.y + lineBox.height / 2,
    }

    await ctrlShiftDrag(page, from, { x: from.x, y: from.y + 40 })

    // Happy: a solid own-style copy 40 px lower; the parent line is gone here only.
    await expect(copyLines(page, a)).toHaveCount(1)
    await expect(line).toHaveCount(0)
    const moved = Number(
      await copyLines(page, a).getAttribute('data-offset-mm'),
    )
    expect(moved).toBeCloseTo(150 + 40 / scale, 0)
    const style = await copyLines(page, a).evaluate((el) => {
      const s = getComputedStyle(el)
      return `${s.backgroundImage} ${s.backgroundColor} ${s.pointerEvents}`
    })
    expect(style).toBe('none rgb(107, 105, 106) auto')
    await expect(
      page.locator('button.spread-frame[aria-pressed="true"]'),
    ).toHaveCount(0)
    await expect(parentLines(page, other)).toHaveCount(2)

    await page.keyboard.press('Control+z')
    await expect(copyLines(page, a)).toHaveAttribute('data-offset-mm', '150')
    await page.keyboard.press('Control+z')
    await expect(copyLines(page, a)).toHaveCount(0)
    await expect(parentLines(page, a)).toHaveCount(2)
    await assertDocumentFitsViewport(page)
  })

  test('a copy dropped on its ruler hides the parent guide on this spread; hidden, it neither paints nor snaps', async ({
    page,
  }) => {
    const a = 'painter-spread-3'
    await openSpread(page, a)
    await page.keyboard.press('Shift+R')
    const rulerY = page.getByTestId('ruler-y')
    await expect(rulerY).toBeVisible()
    const scale = await pxPerMm(page, a)
    const spread = await boxOf(canvasSpread(page, a))
    const lineX = spread.x + 420 * scale
    const start = await barePaperAt(page, a, lineX - 30)
    const snapLines = page.getByTestId('snap-line')
    const drawn = canvasSpread(page, a).locator(
      'button.spread-frame[aria-pressed="true"]',
    )
    const drawToLine = async (expectGuideSnaps: number) => {
      await page.keyboard.press('f')
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(lineX - 3, start.y + 12, { steps: 6 })
      await expect(snapLines.filter({ hasText: 'snap · guide' })).toHaveCount(
        expectGuideSnaps,
      )
      await page.mouse.up()
      await expect(drawn).toHaveCount(1)
      const rect = await boxOf(drawn)
      await page.keyboard.press('Control+z')
      await expect(drawn).toHaveCount(0)
      // Back to Select: the override press needs it.
      await page.keyboard.press('v')
      return rect.x + rect.width
    }

    // Shown: a frame drawn near the parent guide snaps to it.
    expect(await drawToLine(1)).toBeCloseTo(lineX, 0)

    const vertical = parentLines(page, a).and(
      page.locator('[data-orientation="vertical"]'),
    )
    const rulerBox = await boxOf(rulerY)
    await ctrlShiftDrag(
      page,
      { x: lineX, y: spread.y + spread.height * 0.6 },
      { x: rulerBox.x + rulerBox.width / 2, y: spread.y + spread.height * 0.6 },
    )

    // Hidden: no copy, no parent line, other spreads keep it.
    await expect(copyLines(page, a)).toHaveCount(0)
    await expect(vertical).toHaveCount(0)
    await expect(parentLines(page, a)).toHaveCount(1)
    await expect(parentLines(page, 'painter-spread-4')).toHaveCount(2)
    expect(await drawToLine(0)).not.toBeCloseTo(lineX, 0)

    // Undo: the copy is back where the press made it.
    await page.keyboard.press('Control+z')
    await expect(copyLines(page, a)).toHaveAttribute('data-offset-mm', '420')
    await assertDocumentFitsViewport(page)
  })
})
