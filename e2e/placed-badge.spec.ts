import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { chooseZoom, readZoomPercent } from './fixtures/zoomMenu'

/** Designer placed-badge spec (Must PB3), 1440 × 900. */

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installPhotoDirectoryPickerStub(page)
})

const listRows = (page: Page) =>
  page.locator('[data-testid^="spread-list-item-"][aria-selected]')

const spreadFrames = (page: Page, spreadId: string) =>
  page.locator(
    `[data-testid="pasteboard-scroll"] [data-testid="spread-view"][data-spread-id="${spreadId}"] [data-testid="spread-frame"]`,
  )

const selectedFrames = (page: Page) =>
  page.locator(
    '[data-testid="pasteboard-scroll"] [data-testid="spread-frame"][aria-pressed="true"]',
  )

const pill = (page: Page) =>
  page.locator('[data-testid="editor-status"][data-pill="true"]')

function rowOf(page: Page, assetId: string): Locator {
  return page.locator(
    `[data-testid="filmstrip-item"][data-asset-id="${assetId}"]`,
  )
}

function badgeOf(page: Page, assetId: string): Locator {
  return rowOf(page, assetId).getByTestId('filmstrip-placed')
}

async function spreadIdsOf(page: Page): Promise<string[]> {
  return listRows(page).evaluateAll((els) =>
    els.map((el) =>
      (el.getAttribute('data-testid') ?? '').slice('spread-list-item-'.length),
    ),
  )
}

/** Session book (Page 1, Pages 2–3, Page 4) with two photos; A on 2–3. */
async function openWithPhotos(page: Page) {
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  const items = page.getByTestId('filmstrip-item')
  await expect(items).toHaveCount(2, { timeout: 30_000 })
  await expect
    .poll(
      async () =>
        (
          await items.evaluateAll((els) =>
            els.map((el) => el.getAttribute('data-asset-id') ?? ''),
          )
        ).filter((id) => id !== '').length,
    )
    .toBe(2)
  const [a, b] = await items.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-asset-id') ?? ''),
  )
  const spreads = await spreadIdsOf(page)
  expect(spreads).toHaveLength(3)
  const [, s1, s2] = spreads
  if (a === undefined || b === undefined || !s1 || !s2) {
    throw new Error('expected two photos and three spreads')
  }
  const onS1 = spreadFrames(page, s1).first()
  await onS1.scrollIntoViewIfNeeded()
  await dropAssetOnFrame(page, a, onS1)
  return { a, b, s1, s2 }
}

async function placeOnS2(page: Page, assetId: string, s2: string) {
  const frame = spreadFrames(page, s2).first()
  await frame.scrollIntoViewIfNeeded()
  await dropAssetOnFrame(page, assetId, frame)
}

/** Badge box against its photo area (`.filmstrip-drag`). */
async function badgeGeometry(badge: Locator) {
  return badge.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const area = el.parentElement?.getBoundingClientRect()
    const check = el.querySelector('svg')?.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      width: r.width,
      height: r.height,
      right: (area?.right ?? 0) - r.right,
      bottom: (area?.bottom ?? 0) - r.bottom,
      check: [check?.width ?? 0, check?.height ?? 0],
      background: cs.backgroundColor,
      backdrop: cs.backdropFilter,
      transform: cs.transform,
      cursor: cs.cursor,
    }
  })
}

test('badge look: 16 px disc at 4 / 4, check 10, hover .8 + 1.125, count pill 24', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, b, s2 } = await openWithPhotos(page)
  await page.mouse.move(700, 20)

  // Unplaced: no badge, no Enter shortcut.
  await expect(badgeOf(page, b)).toHaveCount(0)
  await expect(rowOf(page, b)).not.toHaveAttribute('aria-keyshortcuts')
  await expect(rowOf(page, a)).toHaveAttribute('aria-keyshortcuts', 'Enter')

  const rest = await badgeGeometry(badgeOf(page, a))
  expect(rest.width).toBeCloseTo(16, 0)
  expect(rest.height).toBeCloseTo(16, 0)
  expect(Math.abs(rest.right - 4)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(rest.bottom - 4)).toBeLessThanOrEqual(0.5)
  expect(rest.check).toEqual([10, 10])
  expect(rest.background).toBe('rgba(0, 0, 0, 0.55)')
  expect(rest.backdrop).toBe('blur(8px)')
  await expect(badgeOf(page, a)).toHaveAttribute('title', 'Show in the book')
  await expect(badgeOf(page, a)).toHaveAttribute('role', 'button')
  await expect(badgeOf(page, a)).toHaveAccessibleName('Show in the book')

  // Paint: the disc's top edge (clear of the check) darkens under hover.
  const edge = [{ x: 8, y: 1.5 }]
  const [restPx] = await pixelsAt(badgeOf(page, a), edge)
  await badgeOf(page, a).hover()
  await expect
    .poll(async () => (await badgeGeometry(badgeOf(page, a))).transform)
    .toBe('matrix(1.125, 0, 0, 1.125, 0, 0)')
  const hover = await badgeGeometry(badgeOf(page, a))
  expect(hover.background).toBe('rgba(0, 0, 0, 0.8)')
  expect(hover.cursor).toBe('pointer')
  const [hoverPx] = await pixelsAt(badgeOf(page, a), [{ x: 9, y: 2 }])
  const lum = (px: number[] | undefined) =>
    (px ?? []).slice(0, 3).reduce((sum, v) => sum + v, 0)
  expect(lum(hoverPx)).toBeLessThan(lum(restPx))

  await page.mouse.move(700, 20)
  await placeOnS2(page, a, s2)
  await expect(badgeOf(page, a)).toHaveText('2')
  await expect(badgeOf(page, a)).toHaveAccessibleName(
    'Show in the book, placed 2 times',
  )
  const count = await badgeGeometry(badgeOf(page, a))
  expect(Math.abs(count.width - 24)).toBeLessThanOrEqual(1)
  expect(count.height).toBeCloseTo(16, 0)
  expect(Math.abs(count.right - 4)).toBeLessThanOrEqual(0.5)
})

test('clicks cycle the places with the pill, keep zoom and leave the row unselected', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, s1, s2 } = await openWithPhotos(page)
  await placeOnS2(page, a, s2)
  await listRows(page).nth(0).click()
  await expect(selectedFrames(page)).toHaveCount(0)
  const zoom = await readZoomPercent(page)

  await badgeOf(page, a).click()
  await expect(listRows(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(selectedFrames(page)).toHaveCount(1)
  await expect(spreadFrames(page, s1).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('spread-frame-handles')).toHaveCount(1)
  await expect(rowOf(page, a)).toHaveAttribute('aria-selected', 'false')
  await expect(pill(page)).toHaveText('Placed 1 of 2 · Pages 2–3')
  expect(await readZoomPercent(page)).toBe(zoom)

  await badgeOf(page, a).click()
  await expect(listRows(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(spreadFrames(page, s2).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(pill(page)).toHaveText('Placed 2 of 2 · Page 4')
  await expect(pill(page)).toBeVisible()

  // Wraps.
  await badgeOf(page, a).click()
  await expect(spreadFrames(page, s1).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(pill(page)).toHaveText('Placed 1 of 2 · Pages 2–3')
  expect(await readZoomPercent(page)).toBe(zoom)

  // The frame is in view: another jump to it leaves the pasteboard still.
  const scroll = page.getByTestId('pasteboard-scroll')
  const at = () =>
    scroll.evaluate((el) => [el.scrollLeft, el.scrollTop].join(','))
  await page.getByTestId('pasteboard-scroll').press('Escape')
  await listRows(page).nth(1).click()
  const before = await at()
  await badgeOf(page, a).click()
  await expect(spreadFrames(page, s1).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Two frames for the settle check, then the scroll is unchanged.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  expect(await at()).toBe(before)
  await expect(pill(page)).toHaveCount(0, { timeout: 5_000 })
})

/** The selected frame's box, the pasteboard port and the spread list's right edge. */
async function revealGeometry(page: Page) {
  return page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>(
      '[data-testid="pasteboard-scroll"]',
    )
    const frame = scroll
      ?.querySelector('[data-testid="spread-frame"][aria-pressed="true"]')
      ?.getBoundingClientRect()
    const port = scroll?.getBoundingClientRect()
    const list = document
      .querySelector('[data-testid="spreads-panel"]')
      ?.getBoundingClientRect()
    return {
      held: scroll?.dataset.revealHold === 'true',
      scroll: `${String(scroll?.scrollLeft)},${String(scroll?.scrollTop)}`,
      frame: frame && {
        left: frame.left,
        top: frame.top,
        right: frame.right,
        bottom: frame.bottom,
      },
      port: port && {
        left: port.left,
        top: port.top,
        right: port.right,
        bottom: port.bottom,
      },
      listRight: list?.right ?? 0,
    }
  })
}

/** Waits for any reveal + nudge to end: no hold, scroll still across polls. */
async function scrollSettled(page: Page) {
  let last = ''
  await expect
    .poll(
      async () => {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        )
        const g = await revealGeometry(page)
        const key = `${String(g.held)}|${g.scroll}`
        const still = !g.held && key === last
        last = key
        return still
      },
      { timeout: 10_000 },
    )
    .toBe(true)
}

async function settledReveal(page: Page) {
  await scrollSettled(page)
  const g = await revealGeometry(page)
  if (!g.frame || !g.port) {
    throw new Error('expected a selected frame on the pasteboard')
  }
  return { frame: g.frame, port: g.port, listRight: g.listRight }
}

test('M145: a jump to a frame under the spread list nudges it 24 px into the port', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, s1 } = await openWithPhotos(page)
  // chooseZoom's '50%' also matches '150%' (substring name match).
  await page.getByTestId('zoom-menu').click()
  await page.getByRole('menuitem', { name: /^50%/ }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  const zoom = await readZoomPercent(page)
  await listRows(page).nth(0).click()
  await scrollSettled(page)
  // Park the frame 100 px under the spread list (the port starts at its
  // right edge): the jump scrolls it right, to the 24 px inset line.
  const target = spreadFrames(page, s1).first()
  const listEdge =
    (await page
      .getByTestId('spreads-panel')
      .evaluate((el) => el.getBoundingClientRect().right)) - 100
  const before = await target.boundingBox()
  await page.getByTestId('pasteboard-scroll').evaluate(
    (el, dx) => {
      el.scrollLeft += dx
    },
    (before?.x ?? 0) - listEdge,
  )
  await scrollSettled(page)
  const parked = await target.boundingBox()
  expect(Math.abs((parked?.x ?? 0) - listEdge)).toBeLessThanOrEqual(1)

  // Sample scrollLeft per frame: the spread reveal used to flip the wide
  // spread between its two edges every frame until its try budget ran out.
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-testid="pasteboard-scroll"]',
    )
    const lefts: number[] = []
    Object.assign(window, { revealLefts: lefts })
    const tick = () => {
      lefts.push(el?.scrollLeft ?? 0)
      if (lefts.length < 120) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
  await badgeOf(page, a).click()
  await expect(selectedFrames(page)).toHaveCount(1)
  const { frame, port, listRight } = await settledReveal(page)
  const lefts = await page.evaluate(
    () => (window as unknown as { revealLefts: number[] }).revealLefts,
  )
  // One sideways move straight to the frame (no spread reveal first).
  expect(
    lefts.filter((x, i) => i > 0 && x !== lefts[i - 1]).length,
  ).toBeLessThanOrEqual(1)

  // Fits (≈ 510 px < 880 × 672): inside the port inset by 24 px on both axes.
  expect(port.left).toBeCloseTo(listRight, 0)
  expect(frame.left).toBeGreaterThanOrEqual(listRight + 24 - 1)
  expect(frame.right).toBeLessThanOrEqual(port.right - 24 + 1)
  expect(frame.top).toBeGreaterThanOrEqual(port.top + 24 - 1)
  expect(frame.bottom).toBeLessThanOrEqual(port.bottom - 24 + 1)
  // Least scroll: the left edge lands on the inset line, not centred.
  expect(Math.abs(frame.left - (listRight + 24))).toBeLessThanOrEqual(1)
  // Paint: the left mid handle is the topmost thing there, not the list.
  const hit = await page.evaluate(
    ([x, y]) => {
      const top = document.elementsFromPoint(x ?? 0, y ?? 0)[0]
      return {
        list: top?.closest('[data-testid="spreads-panel"]') != null,
        frame:
          top?.closest(
            '[data-testid="spread-frame-handles"], [data-testid="spread-frame"]',
          ) != null,
      }
    },
    [frame.left + 1, (frame.top + frame.bottom) / 2],
  )
  expect(hit).toEqual({ list: false, frame: true })
  expect(await readZoomPercent(page)).toBe(zoom)
})

test('M145: at 200 % a frame larger than the port is centred on both axes', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a } = await openWithPhotos(page)
  await chooseZoom(page, '200%')
  const zoom = await readZoomPercent(page)
  await listRows(page).nth(0).click()
  await expect(page.getByTestId('pasteboard-scroll')).not.toHaveAttribute(
    'data-reveal-hold',
  )

  await badgeOf(page, a).click()
  await expect(selectedFrames(page)).toHaveCount(1)
  const { frame, port } = await settledReveal(page)

  expect(frame.bottom - frame.top).toBeGreaterThan(port.bottom - port.top)
  expect(frame.right - frame.left).toBeGreaterThan(port.right - port.left)
  const cutTop = port.top - frame.top
  const cutBottom = frame.bottom - port.bottom
  expect(Math.abs(cutTop - cutBottom)).toBeLessThanOrEqual(2)
  const cutLeft = port.left - frame.left
  const cutRight = frame.right - port.right
  expect(Math.abs(cutLeft - cutRight)).toBeLessThanOrEqual(2)
  expect(await readZoomPercent(page)).toBe(zoom)
})

type ScrollSample = [left: number, top: number]

/**
 * Runs `act` while sampling the pasteboard scroll every animation frame until
 * the jump has settled; returns the samples (the first is before `act`).
 */
async function traceJump(
  page: Page,
  act: () => Promise<void>,
): Promise<ScrollSample[]> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const el = document.querySelector<HTMLElement>(
          '[data-testid="pasteboard-scroll"]',
        )
        const trace = { on: true, samples: [] as ScrollSample[] }
        Object.assign(window, { scrollTrace: trace })
        const tick = () => {
          if (!trace.on) {
            return
          }
          trace.samples.push([el?.scrollLeft ?? 0, el?.scrollTop ?? 0])
          if (trace.samples.length === 2) {
            resolve()
          }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
  )
  await act()
  await expect(selectedFrames(page)).toHaveCount(1)
  await scrollSettled(page)
  return page.evaluate(() => {
    const trace = (
      window as unknown as {
        scrollTrace: { on: boolean; samples: ScrollSample[] }
      }
    ).scrollTrace
    trace.on = false
    return trace.samples
  })
}

/** How often one axis (0 = scrollLeft, 1 = scrollTop) changed between frames. */
function axisMoves(samples: readonly ScrollSample[], axis: 0 | 1): number {
  return samples.filter((s, i) => i > 0 && s[axis] !== samples[i - 1]?.[axis])
    .length
}

test('M145: at 200 % a jump scrolls each axis once; a re-click on the frame in the port does not scroll', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, s2 } = await openWithPhotos(page)
  await chooseZoom(page, '200%')
  await listRows(page).nth(0).click()
  await scrollSettled(page)

  // Fresh jump from Page 1: one move per axis, straight to the centred frame.
  const fresh = await traceJump(page, () => badgeOf(page, a).click())
  expect(axisMoves(fresh, 1)).toBe(1)
  expect(axisMoves(fresh, 0)).toBeLessThanOrEqual(1)
  const first = await settledReveal(page)
  const cutTop = first.port.top - first.frame.top
  const cutBottom = first.frame.bottom - first.port.bottom
  expect(Math.abs(cutTop - cutBottom)).toBeLessThanOrEqual(1)

  // Re-click (one place): the frame is already where the rule puts it.
  const again = await traceJump(page, () => badgeOf(page, a).click())
  expect(axisMoves(again, 0)).toBe(0)
  expect(axisMoves(again, 1)).toBe(0)
  const second = await settledReveal(page)
  expect(second.frame.left).toBe(first.frame.left)
  expect(second.frame.top).toBe(first.frame.top)

  // Cycle from the frame on Pages 2–3 to Page 4: no sideways flash.
  await placeOnS2(page, a, s2)
  await listRows(page).nth(0).click()
  await scrollSettled(page)
  await badgeOf(page, a).click()
  await expect(pill(page)).toHaveText('Placed 1 of 2 · Pages 2–3')
  await scrollSettled(page)
  const cycle = await traceJump(page, () => badgeOf(page, a).click())
  await expect(pill(page)).toHaveText('Placed 2 of 2 · Page 4')
  await expect(spreadFrames(page, s2).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(axisMoves(cycle, 0)).toBeLessThanOrEqual(1)
  expect(axisMoves(cycle, 1)).toBeLessThanOrEqual(1)
})

test('M145: at 1060 wide a jump scrolls each axis once to the 24 px inset', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1060, height: 900 })
  const { a } = await openWithPhotos(page)
  await listRows(page).nth(0).click()
  await scrollSettled(page)

  const trace = await traceJump(page, () => badgeOf(page, a).click())
  expect(axisMoves(trace, 0)).toBeLessThanOrEqual(1)
  expect(axisMoves(trace, 1)).toBeLessThanOrEqual(1)
  const { frame, port, listRight } = await settledReveal(page)
  expect(port.left).toBeCloseTo(listRight, 0)
  expect(frame.left).toBeGreaterThanOrEqual(port.left + 24 - 0.5)
  expect(frame.right).toBeLessThanOrEqual(port.right - 24 + 0.5)
})

test('Enter on the focused row cycles and keeps focus; Masters → Pages', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, b, s1, s2 } = await openWithPhotos(page)
  await placeOnS2(page, a, s2)
  await listRows(page).nth(0).click()

  await rowOf(page, b).focus()
  await page.keyboard.press('Enter')
  await expect(selectedFrames(page)).toHaveCount(0)

  await rowOf(page, a).focus()
  await page.keyboard.press('Enter')
  await expect(spreadFrames(page, s1).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(rowOf(page, a)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(spreadFrames(page, s2).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(rowOf(page, a)).toBeFocused()

  await page.getByTestId('left-tab-masters').click()
  await expect(page.getByTestId('masters-panel')).toBeVisible()
  await badgeOf(page, a).click()
  await expect(page.getByTestId('masters-panel')).toHaveCount(0)
  await expect(page.getByTestId('left-tab-pages')).toBeVisible()
  await expect(selectedFrames(page)).toHaveCount(1)
  await expect(pill(page)).toHaveText(/^Placed [12] of 2 · /)
})

test('a drag from the badge places the photo; Ctrl+Z undoes the drop, not the jump', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { a, s2 } = await openWithPhotos(page)
  const target = spreadFrames(page, s2).first()
  await target.scrollIntoViewIfNeeded()
  await expect(target.getByTestId('spread-frame-image')).toHaveCount(0)

  await badgeOf(page, a).dragTo(target)
  await expect(target.getByTestId('spread-frame-image')).toHaveCount(1)
  await expect(badgeOf(page, a)).toHaveText('2')

  await badgeOf(page, a).click()
  await expect(selectedFrames(page)).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(target.getByTestId('spread-frame-image')).toHaveCount(0)
  await expect(badgeOf(page, a)).toHaveText('')
})

test('painter book: 9+ count, a locked frame is selected, the cover is a place', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/?fixture=painter')
  const badge = badgeOf(page, 'painter-a')
  await expect(badge).toHaveText('9+', { timeout: 30_000 })
  await expect(badge).toHaveAccessibleName('Show in the book, placed 40 times')
  const nine = await badgeGeometry(badge)
  expect(nine.width).toBeGreaterThan(24)

  // The last spread (Page 78) holds painter-a's last frame place; the spread
  // list is windowed, so scroll it there first.
  const lastRow = listRows(page).filter({
    has: page.locator('[data-label]', { hasText: /^78$/ }),
  })
  await expect
    .poll(
      async () => {
        await listRows(page).last().scrollIntoViewIfNeeded()
        return lastRow.count()
      },
      { intervals: [100] },
    )
    .toBe(1)
  await lastRow.click()
  await badge.click()
  await expect(pill(page)).toHaveText('Placed 40 of 40 · Page 78')
  const frame = selectedFrames(page)
  await expect(frame).toHaveCount(1)
  await frame.click({ button: 'right' })
  await page.getByTestId('frame-menu-lock').click()
  await expect(page.getByTestId('frame-menu-lock')).toHaveCount(0)

  // Last place still selected → wraps to the cover: the cover row is selected.
  await badge.click()
  await expect(page.getByTestId('cover-list-item')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(pill(page)).toHaveText('Placed 1 of 40 · Cover')

  // From Page 78 again: the locked frame is selected as a click selects it.
  await lastRow.click()
  await badge.click()
  await expect(pill(page)).toHaveText('Placed 40 of 40 · Page 78')
  await expect(selectedFrames(page)).toHaveCount(1)
  await selectedFrames(page).click({ button: 'right' })
  await expect(page.getByTestId('frame-menu-lock')).toHaveText(/Unlock/)
  await page.keyboard.press('Escape')
})
