import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { applyLayout } from './fixtures/layoutTiles'
import { PERF_BUDGETS } from './perf/budgets'
import {
  browserAssertNoLoafAndHandlerP95,
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

// multi-select part 1 (Designer Spec "Canvas", "Clicks and keys"): Shift+click
// builds a set of frames on one spread (src/editor/frameSelection.ts); 2+
// selected show a dashed group box and no handles; Esc clears; Delete removes
// the set in one undo step.

/** Painter fixture spread 1: a 4-grid with four different photos. */
const spread = (page: Page) =>
  page.locator('[data-testid="spread-view"][data-spread-id="painter-spread-1"]')
const frames = (page: Page) => spread(page).getByTestId('spread-frame')
const pressed = (page: Page) =>
  spread(page).locator('[data-testid="spread-frame"][aria-pressed="true"]')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return box
}

async function assetIds(page: Page): Promise<(string | null)[]> {
  return frames(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-asset-id')),
  )
}

test.describe('multi-select: Shift+click, group box, Esc, Delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).first().scrollIntoViewIfNeeded()
  })

  test('Shift+click two frames: both pressed, no handles, group box = union + 4, no swap', async ({
    page,
  }) => {
    const before = await assetIds(page)
    const a = frames(page).nth(0)
    const b = frames(page).nth(1)
    await a.click()
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
    await b.click({ modifiers: ['Shift'] })

    await expect(pressed(page)).toHaveCount(2)
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)
    // Before this change the second click swapped the two photos.
    expect(await assetIds(page)).toEqual(before)
    await expect(b.locator('.spread-frame-body')).toHaveAttribute(
      'draggable',
      'false',
    )

    const group = spread(page).getByTestId('group-box')
    await expect(group).toHaveCount(1)
    const [boxA, boxB, boxG] = await Promise.all([
      boxOf(a),
      boxOf(b),
      boxOf(group),
    ])
    const left = Math.min(boxA.x, boxB.x)
    const top = Math.min(boxA.y, boxB.y)
    const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width)
    const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height)
    expect(Math.abs(boxG.x - (left - 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.y - (top - 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.x + boxG.width - (right + 4))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(boxG.y + boxG.height - (bottom + 4))).toBeLessThanOrEqual(
      0.5,
    )
    const paint = await group.evaluate((el) => {
      const s = getComputedStyle(el)
      const after = getComputedStyle(el, '::after')
      return {
        style: after.outlineStyle,
        width: after.outlineWidth,
        color: after.outlineColor,
        bg: s.backgroundColor,
        events: s.pointerEvents,
      }
    })
    expect(paint).toEqual({
      style: 'dashed',
      width: '1px',
      color: 'rgb(142, 142, 142)',
      bg: 'rgba(0, 0, 0, 0)',
      events: 'none',
    })
    await assertDocumentFitsViewport(page)

    // Shift+click again: back to one frame with handles.
    await b.click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(1)
    await expect(a).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
    await expect(group).toHaveCount(0)

    // Shift+Enter on a focused frame toggles it too; Esc clears the set.
    await b.focus()
    await page.keyboard.press('Shift+Enter')
    await expect(pressed(page)).toHaveCount(2)
    expect(await assetIds(page)).toEqual(before)
    await page.keyboard.press('Escape')
    await expect(pressed(page)).toHaveCount(0)
    await expect(group).toHaveCount(0)
  })

  test('the group box stays 4 screen px out with a 1px outline on every frame of a Ctrl+wheel zoom', async ({
    page,
  }) => {
    await frames(page).nth(0).click()
    await frames(page)
      .nth(1)
      .click({ modifiers: ['Shift'] })
    await expect(spread(page).getByTestId('group-box')).toHaveCount(1)

    const samples = await page
      .getByTestId('pasteboard-scroll')
      .evaluate(async (scroll) => {
        const view = document.querySelector(
          '[data-testid="spread-view"][data-spread-id="painter-spread-1"]',
        )
        const world = document.querySelector<HTMLElement>(
          '[data-testid="pasteboard-world"]',
        )
        if (view === null || world === null) throw new Error('no spread view')
        const sample = () => {
          const box = view.querySelector<HTMLElement>(
            '[data-testid="group-box"]',
          )
          if (box === null) return null
          const picked = [
            ...view.querySelectorAll(
              '[data-testid="spread-frame"][aria-pressed="true"]',
            ),
          ].map((el) => el.getBoundingClientRect())
          const g = box.getBoundingClientRect()
          const s = getComputedStyle(box)
          const scale = Number(s.getPropertyValue('--cam-scale') || '1')
          // The outline is drawn on ::after, counter-scaled by 1 / scale.
          const after = getComputedStyle(box, '::after')
          const local = scale * parseFloat(after.scale || '1')
          return {
            gesture: world.dataset.gesture === 'zoom',
            gaps: [
              Math.min(...picked.map((r) => r.left)) - g.left,
              Math.min(...picked.map((r) => r.top)) - g.top,
              g.right - Math.max(...picked.map((r) => r.right)),
              g.bottom - Math.max(...picked.map((r) => r.bottom)),
            ],
            outline: parseFloat(after.outlineWidth) * local,
            // ::after spans the box: its width on screen = the box's.
            span: parseFloat(after.width) * local - g.width,
          }
        }
        const frame = (): Promise<void> =>
          new Promise((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        const r = scroll.getBoundingClientRect()
        const out: ReturnType<typeof sample>[] = []
        for (const deltaY of [...Array(6).fill(-120), ...Array(6).fill(120)]) {
          scroll.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: deltaY as number,
              ctrlKey: true,
              clientX: r.x + r.width / 2,
              clientY: r.y + r.height / 2,
              bubbles: true,
              cancelable: true,
            }),
          )
          await frame()
          out.push(sample())
        }
        return out
      })
    expect(samples).toHaveLength(12)
    // Mid-gesture samples are what the review saw drift (2.01–6.32 px).
    expect(samples.some((s) => s?.gesture)).toBe(true)
    for (const s of samples) {
      expect(s).not.toBeNull()
      for (const gap of s?.gaps ?? [])
        expect(Math.abs(gap - 4)).toBeLessThanOrEqual(0.5)
      expect(Math.abs((s?.outline ?? 0) - 1)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(s?.span ?? Infinity)).toBeLessThanOrEqual(0.5)
    }
  })

  test('a plain click inside the set collapses it to that frame', async ({
    page,
  }) => {
    const before = await assetIds(page)
    await frames(page).nth(0).click()
    await frames(page)
      .nth(1)
      .click({ modifiers: ['Shift'] })
    await frames(page)
      .nth(2)
      .click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(3)
    await frames(page).nth(1).click()
    await expect(pressed(page)).toHaveCount(1)
    await expect(frames(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
    expect(await assetIds(page)).toEqual(before)
  })

  test('Delete with three selected, one locked, removes all three in one undo step', async ({
    page,
  }) => {
    const ids = await frames(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-frame-id')),
    )
    // Lock the third frame (Ctrl+Shift+L on a single selection).
    await frames(page).nth(2).click()
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frames(page).nth(2)).toHaveAttribute('data-locked', 'true')

    // The locked frame stays selected; Shift+click adds the other two.
    await frames(page)
      .nth(0)
      .click({ modifiers: ['Shift'] })
    await frames(page)
      .nth(1)
      .click({ modifiers: ['Shift'] })
    await expect(pressed(page)).toHaveCount(3)
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)

    await page.keyboard.press('Delete')
    // The lock guards geometry and drops, not deletion (as the Delete frame
    // button): all three go.
    await expect(frames(page)).toHaveCount(1)
    await expect(frames(page).first()).toHaveAttribute(
      'data-frame-id',
      ids[3] ?? '',
    )
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Delete 3 frames” (Ctrl+Z)',
    )

    await page.getByTestId('undo').click()
    await expect(frames(page)).toHaveCount(4)
    expect(
      await frames(page).evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-frame-id')),
      ),
    ).toEqual(ids)
    await expect(frames(page).nth(2)).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Lock frame” (Ctrl+Z)',
    )
  })
})

/** Painter trim is 300 mm tall: client px per mm of spread 1. */
async function pxPerMm(page: Page): Promise<number> {
  return (await boxOf(spread(page))).height / 300
}

/** Lock frame 1, then Shift+click frames 0 and 2: three selected, one locked. */
async function selectThreeOneLocked(page: Page): Promise<void> {
  await frames(page).nth(1).click()
  await page.keyboard.press('Control+Shift+KeyL')
  await expect(frames(page).nth(1)).toHaveAttribute('data-locked', 'true')
  await frames(page)
    .nth(0)
    .click({ modifiers: ['Shift'] })
  await frames(page)
    .nth(2)
    .click({ modifiers: ['Shift'] })
  await expect(pressed(page)).toHaveCount(3)
}

async function frameBoxes(page: Page) {
  return Promise.all([0, 1, 2].map((index) => boxOf(frames(page).nth(index))))
}

/** Press frame 0's centre and move by (dxMm, 0) with Alt (no snapping), button still down. */
async function pressAndMove(page: Page, dxMm: number): Promise<void> {
  const start = await boxOf(frames(page).nth(0))
  const x = start.x + start.width / 2
  const y = start.y + start.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.keyboard.down('Alt')
  await page.mouse.move(x + dxMm * (await pxPerMm(page)), y, { steps: 12 })
}

test.describe('multi-select part 2: group move, Esc, arrows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).first().scrollIntoViewIfNeeded()
    await selectThreeOneLocked(page)
  })

  test('dragging a set moves the unlocked frames by one delta in one undo step; the locked one stays', async ({
    page,
  }) => {
    const scale = await pxPerMm(page)
    const before = await frameBoxes(page)
    await pressAndMove(page, 20)
    await page.mouse.up()
    await page.keyboard.up('Alt')

    const after = await frameBoxes(page)
    for (const index of [0, 2]) {
      const dx = ((after[index]?.x ?? 0) - (before[index]?.x ?? 0)) / scale
      const dy = ((after[index]?.y ?? 0) - (before[index]?.y ?? 0)) / scale
      expect(Math.abs(dx - 20)).toBeLessThanOrEqual(0.1)
      expect(Math.abs(dy)).toBeLessThanOrEqual(0.1)
    }
    expect(after[1]).toEqual(before[1])
    await expect(pressed(page)).toHaveCount(3)
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Move 2 frames” (Ctrl+Z)',
    )

    await page.getByTestId('undo').click()
    await expect.poll(() => frameBoxes(page)).toEqual(before)
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Lock frame” (Ctrl+Z)',
    )
    await assertDocumentFitsViewport(page)
  })

  test('Esc mid-move puts every frame back and keeps the three selected', async ({
    page,
  }) => {
    const before = await frameBoxes(page)
    await pressAndMove(page, 20)
    expect((await frameBoxes(page))[0]?.x).not.toBe(before[0]?.x)
    await page.keyboard.press('Escape')
    expect(await frameBoxes(page)).toEqual(before)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    expect(await frameBoxes(page)).toEqual(before)
    await expect(pressed(page)).toHaveCount(3)
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Lock frame” (Ctrl+Z)',
    )
  })

  test('ArrowRight nudges the set 1 mm and does not scroll the pasteboard', async ({
    page,
  }) => {
    const scale = await pxPerMm(page)
    const scroll = page.getByTestId('pasteboard-scroll')
    const left = await scroll.evaluate((el) => el.scrollLeft)
    const before = await frameBoxes(page)
    await page.keyboard.press('ArrowRight')
    await expect
      .poll(
        async () => ((await frameBoxes(page))[0]?.x ?? 0) - (before[0]?.x ?? 0),
      )
      .toBeGreaterThan(0)
    const after = await frameBoxes(page)
    for (const index of [0, 2]) {
      const dx = ((after[index]?.x ?? 0) - (before[index]?.x ?? 0)) / scale
      expect(Math.abs(dx - 1)).toBeLessThanOrEqual(0.1)
    }
    expect(after[1]).toEqual(before[1])
    expect(await scroll.evaluate((el) => el.scrollLeft)).toBe(left)
    await expect(pressed(page)).toHaveCount(3)
  })

  test('the group box stays the union + 4 px on every animation frame of the drag', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const view = document.querySelector(
        '[data-testid="spread-view"][data-spread-id="painter-spread-1"]',
      )
      if (view === null) throw new Error('no spread view')
      const state = { samples: [] as number[][], stop: false }
      Object.assign(window, { __groupSampler: state })
      const tick = () => {
        if (state.stop) return
        const box = view.querySelector('[data-testid="group-box"]')
        const picked = [
          ...view.querySelectorAll(
            '[data-testid="spread-frame"][aria-pressed="true"]',
          ),
        ].map((el) => el.getBoundingClientRect())
        if (box !== null && picked.length === 3) {
          const g = box.getBoundingClientRect()
          state.samples.push([
            Math.min(...picked.map((r) => r.left)) - g.left,
            Math.min(...picked.map((r) => r.top)) - g.top,
            g.right - Math.max(...picked.map((r) => r.right)),
            g.bottom - Math.max(...picked.map((r) => r.bottom)),
            picked[0]?.left ?? 0,
          ])
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await pressAndMove(page, 20)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    const samples = await page.evaluate(() => {
      const state = (
        window as unknown as {
          __groupSampler: { samples: number[][]; stop: boolean }
        }
      ).__groupSampler
      state.stop = true
      return state.samples
    })
    const lefts = new Set(samples.map((s) => Math.round(s[4] ?? 0)))
    // The drag was sampled mid-move, not only before and after.
    expect(lefts.size).toBeGreaterThan(3)
    for (const sample of samples) {
      for (const gap of sample.slice(0, 4))
        expect(Math.abs(gap - 4)).toBeLessThanOrEqual(0.5)
    }
  })
})

// multi-select part 3 (Designer Spec "Canvas" → Marquee): a Select drag from
// the pasteboard gray or bare paper selects the target spread's frames it
// touches (src/editor/marquee.ts); Shift unions, Esc restores, Hand pans.

const hits = (page: Page) =>
  spread(page).locator('[data-testid="spread-frame"][data-marquee-hit="true"]')

/** Frame centres in client px, frames 0–3 of the 4-grid. */
async function centres(page: Page): Promise<[Point, Point, Point, Point]> {
  const centre = async (index: number) => {
    const box = await boxOf(frames(page).nth(index))
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  return [await centre(0), await centre(1), await centre(2), await centre(3)]
}

interface Point {
  x: number
  y: number
}

/** Press on the gray 20 px left of the spread at y, drag to (x2, y2), button still down. */
async function marqueeFromGray(
  page: Page,
  y: number,
  to: { x: number; y: number },
): Promise<void> {
  const paper = await boxOf(spread(page))
  await page.mouse.move(paper.x - 20, y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
}

test.describe('multi-select part 3: marquee', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fixture=painter')
    await expect(frames(page)).toHaveCount(4)
    await spread(page).scrollIntoViewIfNeeded()
  })

  test('a marquee from the pasteboard over a full-bleed spread selects the frame it touches', async ({
    page,
  }) => {
    const paper = await boxOf(spread(page))
    // A gray click activates spread 1 (no selection); the layout goes there.
    await page.mouse.click(paper.x - 20, paper.y + 20)
    await applyLayout(page, 'Full bleed', { restorePanel: true })
    await expect(frames(page)).toHaveCount(1)
    const bleed = await boxOf(spread(page))
    // No free paper anywhere: the press starts on the gray beside it.
    await marqueeFromGray(page, bleed.y + 40, {
      x: bleed.x + 60,
      y: bleed.y + 80,
    })
    await expect(hits(page)).toHaveCount(1)
    await page.mouse.up()
    await expect(pressed(page)).toHaveCount(1)
    await expect(page.getByTestId('marquee')).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })

  test('a press 10 px above spread 2–3 targets it (nearest paper) and makes it active', async ({
    page,
  }) => {
    const slot = (id: string) =>
      page.locator(`[data-testid="pasteboard-slot"][data-spread-id="${id}"]`)
    const paper = await boxOf(spread(page))
    const [c0] = await centres(page)
    // The gap above spread 2–3 belongs to page 1's slot: a click goes there.
    await page.mouse.click(c0.x, paper.y - 10)
    await expect(slot('painter-spread-0')).toHaveAttribute(
      'data-active',
      'true',
    )
    await page.mouse.move(c0.x, paper.y - 10)
    await page.mouse.down()
    await page.mouse.move(c0.x, c0.y, { steps: 12 })
    await expect(slot('painter-spread-1')).toHaveAttribute(
      'data-active',
      'true',
    )
    await expect(hits(page)).toHaveCount(1)
    await page.mouse.up()
    await expect(pressed(page)).toHaveCount(1)
    await expect(frames(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
  })

  test('across the top row selects frames 0 and 1; Shift over the bottom row unions all four', async ({
    page,
  }) => {
    const [c0, c1] = await centres(page)
    await marqueeFromGray(page, c0.y, { x: c1.x, y: c0.y + 10 })
    // Live outlines, nothing committed; the box is screen px, kit look.
    await expect(hits(page)).toHaveCount(2)
    await expect(pressed(page)).toHaveCount(0)
    const paper = await boxOf(spread(page))
    const marquee = page.getByTestId('marquee')
    const look = await marquee.evaluate((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return {
        fill: style.backgroundColor,
        outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
        radius: style.borderRadius,
        width: rect.width,
        height: rect.height,
      }
    })
    // color-mix() computes to `color(srgb r g b / a)` with 0–1 channels.
    const fill = (look.fill.match(/[\d.]+/g) ?? []).map(Number)
    expect(fill.slice(0, 3).map((v) => Math.round(v * 255))).toEqual([
      35, 34, 35,
    ])
    expect(fill[3]).toBeCloseTo(0.1)
    expect(look).toMatchObject({
      outline: '1px solid rgb(142, 142, 142)',
      radius: '0px',
    })
    expect(Math.abs(look.width - (c1.x - (paper.x - 20)))).toBeLessThan(1)
    expect(Math.abs(look.height - 10)).toBeLessThan(1)
    await page.mouse.up()
    await expect(pressed(page)).toHaveCount(2)
    await expect(frames(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(frames(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('group-box')).toHaveCount(1)

    const [, , b2, b3] = await centres(page)
    await page.keyboard.down('Shift')
    await marqueeFromGray(page, b2.y, { x: b3.x, y: b2.y + 10 })
    await expect(hits(page)).toHaveCount(4)
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await expect(pressed(page)).toHaveCount(4)
  })

  test('Esc mid-marquee restores the previous selection', async ({ page }) => {
    await frames(page).nth(3).click()
    await expect(pressed(page)).toHaveCount(1)
    const [c0, c1] = await centres(page)
    await marqueeFromGray(page, c0.y, { x: c1.x, y: c0.y + 10 })
    await expect(hits(page)).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('marquee')).toHaveCount(0)
    await expect(hits(page)).toHaveCount(0)
    await page.mouse.up()
    await expect(pressed(page)).toHaveCount(1)
    await expect(frames(page).nth(3)).toHaveAttribute('aria-pressed', 'true')
  })

  test('a Hand tool drag on the gray pans and draws no marquee', async ({
    page,
  }) => {
    await page.getByTestId('tool-hand').click()
    const scroll = page.getByTestId('pasteboard-scroll')
    const before = await scroll.evaluate((el) => el.scrollTop)
    const [c0, c1] = await centres(page)
    await marqueeFromGray(page, c0.y, { x: c1.x, y: c0.y - 60 })
    await expect(page.getByTestId('marquee')).toHaveCount(0)
    await page.mouse.up()
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(before)
    await expect(pressed(page)).toHaveCount(0)
  })
})

test.describe('Multi-select frame-budget gates', () => {
  test('a marquee over a full spread logs no LoAF and keeps the handler p95', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(frames(page)).toHaveCount(4)
    await spread(page).scrollIntoViewIfNeeded()
    const [c0, , , c3] = await centres(page)

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    await marqueeFromGray(page, c0.y - 20, c3)
    await page.mouse.move(c0.x, c0.y, { steps: 40 })
    await page.mouse.move(c3.x, c3.y, { steps: 40 })
    await page.mouse.up()
    await expect(pressed(page)).toHaveCount(4)
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafAndHandlerP95, {
      label: 'frame-gesture',
      budgetMs: PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate,
    })
    await collectFrameStatsArtifact(page, testInfo)
  })

  test('a 3-frame group move logs no LoAF and keeps the handler p95', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).nth(0).click()
    for (const index of [1, 2]) {
      await frames(page)
        .nth(index)
        .click({ modifiers: ['Shift'] })
    }
    await expect(pressed(page)).toHaveCount(3)

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    const start = await boxOf(frames(page).nth(0))
    const x = start.x + start.width / 2
    const y = start.y + start.height / 2
    const scale = await pxPerMm(page)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 30 * scale, y + 10 * scale, { steps: 40 })
    await page.mouse.move(x + 5 * scale, y + 5 * scale, { steps: 40 })
    await page.mouse.up()
    await expect(page.getByTestId('undo')).toHaveAttribute(
      'aria-label',
      'Undo “Move 3 frames” (Ctrl+Z)',
    )
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafAndHandlerP95, {
      label: 'frame-gesture',
      budgetMs: PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate,
    })
    await collectFrameStatsArtifact(page, testInfo)
  })

  test('Shift+click and the group box draw log no LoAF', async ({ page }) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(frames(page)).toHaveCount(4)
    await frames(page).nth(0).click()
    await expect(pressed(page)).toHaveCount(1)

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    for (const index of [1, 2, 3, 2, 1]) {
      await frames(page)
        .nth(index)
        .click({ modifiers: ['Shift'] })
      await page.waitForTimeout(120)
    }
    await expect(pressed(page)).toHaveCount(2)
    await expect(spread(page).getByTestId('group-box')).toHaveCount(1)
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafThenClear)
  })
})
