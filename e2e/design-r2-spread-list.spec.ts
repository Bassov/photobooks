import assert from 'node:assert/strict'
import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  expectKitGapRatio,
  spreadBoxes,
  zoomOutToFloor,
} from './fixtures/stackGap'
import { readZoomPercent } from './fixtures/zoomMenu'

// Owner prod shot 2026-10-31 vs kit #/demo: uikit/src/sandbox/chrome.tsx
// (SpreadsPanel list :266-322) and uikit/src/sandbox/viewport.tsx (stack :111, :319).

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox()
  assert(found !== null, 'element has no box')
  return found
}

/** Session book: 300 × 300 mm trim, default 12 mm spine. */
const COVER_RATIO = (2 * 300 + 12) / 300
const ENDPAPER_RATIO = (2 * 300) / 300

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
})

test('M17: the spread list has no Add spread button; the row menu adds after', async ({
  page,
}) => {
  const panel = page.getByTestId('spreads-panel')
  await expect(page.getByTestId('add-spread')).toHaveCount(0)
  await expect(panel.getByText('Add spread', { exact: true })).toHaveCount(0)
  const scroll = page.getByTestId('pasteboard-scroll')
  await expect(scroll).toHaveAttribute('data-spread-count', '3')
  await page
    .getByTestId(/^spread-menu-/)
    .first()
    .click()
  await page.getByTestId('spread-menu-add').click()
  await expect(scroll).toHaveAttribute('data-spread-count', '4')
  await assertDocumentFitsViewport(page)
})

test('M18: Cover and Endpaper rows scroll with spreads-list', async ({
  page,
}) => {
  await addSpreads(page, 4)
  const list = page.getByTestId('spreads-list')
  await expect
    .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight + 200))
    .toBe(true)
  const scrollTo = async (top: number): Promise<void> => {
    await list.evaluate((el, value) => {
      el.scrollTop = value
    }, top)
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(top)
  }
  const cover = page.getByTestId('cover-list-item')
  const front = page.getByTestId('endpaper-list-item-front')
  await scrollTo(0)
  const [cover0, front0] = [await box(cover), await box(front)]
  await scrollTo(150)
  const [cover1, front1] = [await box(cover), await box(front)]
  expect(Math.abs(cover0.y - 150 - cover1.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(front0.y - 150 - front1.y)).toBeLessThanOrEqual(1)
  // Still rows, not spreads: no reorder handle, no panel-order id.
  await expect(cover).not.toHaveAttribute('data-item')
  await expect(front).not.toHaveAttribute('data-item')
  // Mid-list, spreads-list is still the vertical scrollport (it scrolls on).
  await assertNamedScrollport(page, 'spreads-list', { axis: 'vertical' })

  // The back Endpaper is the list's last row, after the last page.
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const back = page.getByTestId('endpaper-list-item-back')
  await expect(back).toBeVisible()
  const last = await box(page.getByTestId(/^spread-list-item-/).last())
  expect((await box(back)).y).toBeGreaterThanOrEqual(last.y + last.height)
  // At the end there is nothing left to nudge; it must still overflow.
  await assertNamedScrollport(page, 'spreads-list', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
  await assertDocumentFitsViewport(page)
})

test('M19: the Cover card is the kit card at the cover ratio', async ({
  page,
}) => {
  for (const [testId, ratio] of [
    ['cover-list-item', COVER_RATIO],
    ['endpaper-list-item-front', ENDPAPER_RATIO],
  ] as const) {
    const row = page.getByTestId(testId)
    const card = await box(row.locator('[data-thumb-card]'))
    const paper = await box(row.locator('[data-thumb-paper]'))
    // Box: max(ratio, 1.6); paper: full width from 1.6:1 up, at `ratio`.
    expect(
      Math.abs(card.height * Math.max(ratio, 1.6) - card.width),
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(paper.width - card.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(paper.height * ratio - paper.width)).toBeLessThanOrEqual(1)
    // The cover card spans the row like a spread card does.
    const spread = await box(
      page
        .getByTestId(/^spread-list-item-/)
        .first()
        .locator('.editor-spread-thumb'),
    )
    expect(Math.abs(card.width - spread.width)).toBeLessThanOrEqual(1)
  }
})

test('M23: the gap is the kit share of the spread at Fit and after zoom; labels 6 px under', async ({
  page,
}) => {
  const port = await box(page.getByTestId('pasteboard-scroll'))
  const first = (await spreadBoxes(page))[0]
  assert(first !== undefined)
  // Kit Fit band [56, H - 48]: at least pt-14 air above page 1.
  expect(first.y - port.y).toBeGreaterThanOrEqual(55.5)
  await expectKitGapRatio(page)

  const slot = page.locator('[data-pasteboard-slot]').first()
  const spread = await box(slot.getByTestId('spread-view'))
  const label = await box(slot.locator('.page-label:not(:empty)'))
  expect(
    Math.abs(label.y - (spread.y + spread.height) - 6),
  ).toBeLessThanOrEqual(1)

  // The gap scales with the spread (Owner bug fix-spread-gap-zoom), down to
  // the kit Stack floor 0.5 × Fit (Fit / 1.25³ = 0.512 × Fit).
  for (const step of [
    'zoom-in',
    'zoom-out',
    'zoom-out',
    'zoom-out',
    'zoom-out',
  ] as const) {
    const before = await readZoomPercent(page)
    await page.getByTestId(step).click()
    await expect.poll(() => readZoomPercent(page)).not.toBe(before)
    await expectKitGapRatio(page)
  }

  // The smallest reachable zoom keeps the same share too.
  await zoomOutToFloor(page)
  await expectKitGapRatio(page)
})

test('M23: a 40-spread book at the zoom-out floor keeps the gap share and mounts every spread', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  await zoomOutToFloor(page)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
  await expectKitGapRatio(page)
  await assertDocumentFitsViewport(page)
})

/**
 * Shown page numbers of a slot, each with |label centre x − its page centre x|
 * (a single page is the whole spread view, a spread has two halves). Both
 * boxes are read in one frame so a settling camera cannot skew them.
 */
async function labelOffsets(slot: Locator): Promise<[string, number][]> {
  return slot.evaluate((el) => {
    const view = el
      .querySelector('[data-testid="spread-view"]')
      ?.getBoundingClientRect()
    if (view === undefined) return []
    const shown = [...el.querySelectorAll('.page-label')].filter(
      (label) => label.textContent !== '',
    )
    const pageWidth = view.width / shown.length
    return shown.map((label, i): [string, number] => {
      const r = label.getBoundingClientRect()
      const pageCentre = view.x + pageWidth * (i + 0.5)
      return [label.textContent, Math.abs(r.x + r.width / 2 - pageCentre)]
    })
  })
}

async function expectCentred(slot: Locator, texts: string[]): Promise<void> {
  await expect
    .poll(async () =>
      (await labelOffsets(slot)).map(([text, dx]) => [text, dx <= 1]),
    )
    .toEqual(texts.map((text) => [text, true]))
}

test('M24: page numbers sit centred under single and spread pages', async ({
  page,
}) => {
  const slots = page.locator('[data-pasteboard-slot]')
  // Page 1 is a single right page: its number centres under it.
  await expectCentred(slots.first(), ['1'])
  // A two-page spread: each number under its own half.
  await expectCentred(slots.nth(1), ['2', '3'])

  // The single last page (session book: 3 spreads) has one centred number.
  const ids = await page
    .getByTestId(/^spread-list-item-/)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-item') ?? ''))
  const lastId = ids.at(-1) ?? ''
  await page.getByTestId(`spread-list-item-${lastId}`).click()
  const last = page.locator(
    `[data-pasteboard-slot][data-spread-id="${lastId}"]`,
  )
  await expect(last).toHaveAttribute('data-active', 'true')
  await expectCentred(last, ['4'])
})
