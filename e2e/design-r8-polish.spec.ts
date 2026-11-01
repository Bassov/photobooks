import type { Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  STACK_GAP_RATIO,
  spreadBoxes,
  zoomOutToFloor,
} from './fixtures/stackGap'
import { chooseZoom } from './fixtures/zoomMenu'

// Owner Musts, round 8, relayed by Designer 2026-11-01 (prod 8ea1565).
// Kit values measured on the rendered kit `uikit#/demo` (v0.10.0) at
// 1440 × 900, 19 × 23 cm "Lake trip", with getBoundingClientRect:
//
// M48 step 26 (editor-endpaper-selected), `insp-endpaper` at 1140 / 48:
//     head 57.64 (padding 16 16 4), title 1156 / 64; Fill `Sec` top 105.64
//     (px-4 py-4). Row tops: FILL title 121.64 (11 / 14.85 px), Style row
//     148.48 (h 26.84), Pattern row 187.33 (h 24), APPLY title 243.33,
//     "Same on back endpaper" row 270.17 (h 18.84). Style row = kit `Row`
//     justify-between of three: "Pattern" chip x 1239, y 148.48,
//     60 × 26.84; "coming later" x 1358, y 154.48, 66 × 14.84.
// M55 list cards (chrome.tsx:276-277): box x 20, 180 × 108.94; page 1 paper
//     x 110, 90 × 108.94 (SpreadSurface clipped at 50 %), last page paper
//     x 20, 90 × 108.94 (LastPage, the right half has no background or
//     shadow). The empty half paints nothing.
// M56 the kit #/demo never renders the stacked pasteboard (`features.stack`
//     is off), so the pill is the kit `GapDrop` box (32 px) and the Owner
//     rule: centred between the page-number line bottom (8 + 11 px under the
//     page) and the next spread's top. At Fit the gap is 513.25 × 104 / 588 =
//     90.78 px: (90.78 − 19 − 32) / 2 = 19.89 px above and below.

const KIT = {
  endpaper: {
    fillTitle: 121.64,
    styleRow: 148.48,
    patternRow: 187.33,
    applyTitle: 243.33,
    sameRow: 270.17,
    chip: { x: 1239, y: 148.48, width: 60, height: 26.84 },
    note: { x: 1358, y: 154.48, width: 66, height: 14.84 },
  },
  card: { boxX: 20, half: 90, height: 108.94 },
  pill: { height: 32, font: '12px', fitGap: (90.78 - 19 - 32) / 2 },
} as const

const TOL = 0.5

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function near(actual: number, expected: number, tol = TOL): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol)
}

async function rectOf(page: Page, selector: string, index = 0): Promise<Rect> {
  const box = await page
    .locator(selector)
    .nth(index)
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  return box
}

test.describe('M48: Endpaper inspector rows at the kit spacing', () => {
  test('row tops and the Style row boxes equal kit step 26', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    await page.getByTestId('endpaper-list-item-front').click()
    const insp = page.getByTestId('insp-endpaper')
    await expect(insp).toBeVisible()
    const scope = '[data-testid="insp-endpaper"]'

    // r7 head kept: 57.64 tall, padding 16 16 4, title at 1156 / 64.
    const head = await rectOf(page, `${scope} [data-testid="inspector-head"]`)
    near(head.y, 48)
    near(head.height, 57.64)
    const title = await rectOf(
      page,
      `${scope} [data-testid="inspector-context"]`,
    )
    near(title.x, 1156)
    near(title.y, 64)
    await expect(insp.getByTestId('inspector-head')).toHaveCSS(
      'padding',
      '16px 16px 4px',
    )
    await expect(insp.getByTestId('inspector-context')).toHaveCSS(
      'font-size',
      '13px',
    )

    const titles = `${scope} .endpaper-sec-title`
    const rows = `${scope} .endpaper-row`
    await expect(page.locator(titles)).toHaveText(['Fill', 'Apply'])
    near((await rectOf(page, titles, 0)).y, KIT.endpaper.fillTitle)
    near((await rectOf(page, rows, 0)).y, KIT.endpaper.styleRow)
    near((await rectOf(page, rows, 1)).y, KIT.endpaper.patternRow)
    near((await rectOf(page, titles, 1)).y, KIT.endpaper.applyTitle)
    near((await rectOf(page, rows, 2)).y, KIT.endpaper.sameRow)
    await expect(page.locator(rows).nth(2)).toContainText(
      'Same on back endpaper',
    )

    const chip = await rectOf(page, `${scope} [data-testid="endpaper-style"]`)
    const note = await rectOf(
      page,
      `${scope} [data-testid="endp-fill-readonly"]`,
    )
    await expect(insp.getByTestId('endpaper-style')).toHaveText('Pattern')
    await expect(insp.getByTestId('endp-fill-readonly')).toHaveText(
      'coming later',
    )
    for (const [got, kit] of [
      [chip, KIT.endpaper.chip],
      [note, KIT.endpaper.note],
    ] as const) {
      near(got.x, kit.x)
      near(got.y, kit.y)
      near(got.width, kit.width)
      near(got.height, kit.height)
    }
  })
})

const listRows = (page: Page) =>
  page.locator('[data-testid^="spread-list-item-"]')

async function openLakeTrip(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  const count = Number(
    await page
      .getByTestId('pasteboard-scroll')
      .getAttribute('data-spread-count'),
  )
  if (count < 3) await addSpreads(page, 3 - count)
}

interface EmptyHalfRead {
  side: string | null
  label: string
  paper: Rect
  /** Elements over the empty half that paint (background, border, shadow). */
  painted: string[]
}

/** Paint over the empty half of a single-page card, read from computed styles. */
async function readEmptyHalf(
  page: Page,
  index: number,
): Promise<EmptyHalfRead> {
  return listRows(page)
    .nth(index)
    .evaluate((row) => {
      const thumb = row.querySelector('.editor-spread-thumb')
      const paper = thumb?.querySelector('.spread-view')
      const wrap = row.parentElement
      if (thumb == null || paper == null || wrap === null) {
        throw new Error('missing card part')
      }
      const side = row.getAttribute('data-page-side')
      const box = thumb.getBoundingClientRect()
      const half = box.width / 2
      const empty = {
        left: side === 'right' ? box.left : box.left + half,
        right: side === 'right' ? box.left + half : box.right,
        top: box.top,
        bottom: box.bottom,
      }
      const visible = (el: Element): boolean => {
        for (let at: Element | null = el; at !== null; at = at.parentElement) {
          if (getComputedStyle(at).opacity === '0') return false
        }
        return true
      }
      const paints = (style: CSSStyleDeclaration): boolean =>
        style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        style.backgroundImage !== 'none' ||
        style.boxShadow !== 'none' ||
        (style.borderTopStyle !== 'none' && style.borderTopWidth !== '0px') ||
        (style.borderRightStyle !== 'none' &&
          style.borderRightWidth !== '0px') ||
        (style.borderBottomStyle !== 'none' &&
          style.borderBottomWidth !== '0px') ||
        (style.borderLeftStyle !== 'none' && style.borderLeftWidth !== '0px') ||
        (style.outlineStyle !== 'none' && style.outlineWidth !== '0px')
      const painted: string[] = []
      for (const el of wrap.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        const overlaps =
          r.width > 0 &&
          r.height > 0 &&
          r.left < empty.right &&
          r.right > empty.left &&
          r.top < empty.bottom &&
          r.bottom > empty.top
        if (el === row || !overlaps || !visible(el)) continue
        const pseudo = ['::before', '::after'].some((which) => {
          const style = getComputedStyle(el, which)
          return style.content !== 'none' && paints(style)
        })
        if (paints(getComputedStyle(el)) || pseudo) {
          painted.push(`${el.tagName} ${el.getAttribute('class') ?? ''}`)
        }
      }
      const p = paper.getBoundingClientRect()
      return {
        side,
        label: row.querySelector('[data-label]')?.textContent ?? '',
        paper: { x: p.x, y: p.y, width: p.width, height: p.height },
        painted,
      }
    })
}

test.describe('M55: single-page rows paint only their page', () => {
  test('first and last rows: empty half unpainted, page at the kit rect', async ({
    page,
  }) => {
    await openLakeTrip(page)
    // Select a middle row and park the mouse: no selection or hover chrome.
    await listRows(page).nth(1).click()
    await page.mouse.move(700, 450)
    const last = (await listRows(page).count()) - 1
    const labels = await listRows(page).evaluateAll((els) =>
      els.map((el) => el.querySelector('[data-label]')?.textContent ?? ''),
    )
    expect(labels).toEqual(['1', '2–3', '4'])

    const first = await readEmptyHalf(page, 0)
    expect(first.side).toBe('right')
    expect(first.painted).toEqual([])
    near(first.paper.x, KIT.card.boxX + KIT.card.half)
    near(first.paper.width, KIT.card.half)
    near(first.paper.height, KIT.card.height)

    const end = await readEmptyHalf(page, last)
    expect(end.side).toBe('left')
    expect(end.painted).toEqual([])
    near(end.paper.x, KIT.card.boxX)
    near(end.paper.width, KIT.card.half)
    near(end.paper.height, KIT.card.height)

    // The page itself keeps the list thumb shadow.
    await expect(listRows(page).nth(0).locator('.spread-view')).not.toHaveCSS(
      'box-shadow',
      'none',
    )
  })
})

interface PillGaps {
  /** Page-number line bottom → pill top. */
  above: number
  /** Pill bottom → next spread top. */
  below: number
  pill: Rect & { font: string; whiteSpace: string }
  labels: Rect[]
}

/** The pill under slot 0 and its gaps, read in one frame. */
async function readPillGaps(page: Page): Promise<PillGaps | null> {
  return page.getByTestId('pasteboard-scroll').evaluate((port) => {
    const box = (el: Element): Rect => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const slot = port.querySelector('[data-slot-index="0"]')
    const line = slot?.querySelector('.page-labels')
    const pill = slot?.querySelector('[data-testid="pasteboard-gap"]')
    const next = port.querySelector(
      '[data-slot-index="1"] [data-testid="spread-view"]',
    )
    if (line == null || pill == null || next === null) return null
    const p = box(pill)
    const style = getComputedStyle(pill)
    return {
      above: p.y - line.getBoundingClientRect().bottom,
      below: next.getBoundingClientRect().top - (p.y + p.height),
      pill: { ...p, font: style.fontSize, whiteSpace: style.whiteSpace },
      labels: [...port.querySelectorAll('.page-label')]
        .filter((label) => label.textContent !== '')
        .map((label) => {
          const range = document.createRange()
          range.selectNodeContents(label)
          const r = range.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        }),
    }
  })
}

/** Bring the gap under slot 0 to the port centre (zoomed in it is off screen). */
async function centreFirstGap(page: Page): Promise<{ x: number; y: number }> {
  return page.getByTestId('pasteboard-scroll').evaluate((port) => {
    const slot = port.querySelector('[data-slot-index="0"]')
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (slot == null || view == null) throw new Error('slot 0 not mounted')
    const p = port.getBoundingClientRect()
    const s = slot.getBoundingClientRect()
    port.scrollTop +=
      view.getBoundingClientRect().bottom - (p.top + p.height / 2)
    port.scrollLeft += s.left + s.width / 2 - (p.left + p.width / 2)
    return { x: p.left + p.width / 2, y: p.top + p.height / 2 + 30 }
  })
}

/** Real filmstrip drag: pointer down on the photo, moved over the gap, held. */
async function holdFilmstripDrag(
  page: Page,
  over: { x: number; y: number },
): Promise<void> {
  const item = page.getByTestId('filmstrip-item').first()
  const b = await item.boundingBox()
  if (b === null) throw new Error('filmstrip item not visible')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 - 12)
  await page.mouse.move(over.x, over.y, { steps: 8 })
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-asset-drag',
    'true',
  )
}

function gapRatio(boxes: readonly Rect[]): number[] {
  return boxes.slice(1).map((next, i) => {
    const prev = boxes[i]
    return prev === undefined
      ? Number.NaN
      : (next.y - (prev.y + prev.height)) / prev.height
  })
}

async function expectGapRatio(page: Page): Promise<void> {
  await expect
    .poll(async () => (await spreadBoxes(page)).length)
    .toBeGreaterThanOrEqual(2)
  const ratios = gapRatio(await spreadBoxes(page))
  expect(ratios.length).toBeGreaterThan(0)
  for (const ratio of ratios) near(ratio, STACK_GAP_RATIO, 0.001)
}

async function settledSpread(page: Page): Promise<void> {
  let prev = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify((await spreadBoxes(page))[0] ?? null)
        const settled = now === prev
        prev = now
        return settled
      },
      { intervals: [150] },
    )
    .toBe(true)
}

test.describe('M56: the new-spread pill is centred under the page numbers', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await openLakeTrip(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await listRows(page).first().click()
    await chooseZoom(page, 'Fit spread')
    await settledSpread(page)
  })

  test('Fit: equal gaps above and below mid drag, the kit 19.89 px', async ({
    page,
  }) => {
    await expectGapRatio(page)
    const read = await midDragPill(page)
    near(read.above, read.below)
    near(read.above, KIT.pill.fitGap)
    near(read.below, KIT.pill.fitGap)
    await page.mouse.up()
  })

  test('×2 (200 %): equal gaps above and below mid drag', async ({ page }) => {
    await chooseZoom(page, '200%')
    await settledSpread(page)
    await expectGapRatio(page)
    const read = await midDragPill(page)
    near(read.above, read.below)
    await page.mouse.up()
  })

  test('hidden at the zoom floor; the gap stays 104 / 588', async ({
    page,
  }) => {
    await zoomOutToFloor(page)
    await expectGapRatio(page)
    await holdFilmstripDrag(page, await portCentre(page))
    await expect(page.getByTestId('pasteboard-gap')).toHaveCount(0)
    await page.mouse.up()
  })
})

/** Hold a filmstrip drag over the first gap; the pill keeps the r7 rules. */
async function midDragPill(page: Page): Promise<PillGaps> {
  await holdFilmstripDrag(page, await centreFirstGap(page))
  const read = await readPillGaps(page)
  if (read === null) throw new Error('no pill under slot 0')
  near(read.pill.height, KIT.pill.height)
  expect(read.pill.font).toBe(KIT.pill.font)
  expect(read.pill.whiteSpace).toBe('nowrap')
  expect(read.labels.length).toBeGreaterThan(0)
  for (const label of read.labels) {
    const clear =
      read.pill.y >= label.y + label.height ||
      label.y >= read.pill.y + read.pill.height ||
      read.pill.x >= label.x + label.width ||
      label.x >= read.pill.x + read.pill.width
    expect(clear).toBe(true)
  }
  return read
}

async function portCentre(page: Page): Promise<{ x: number; y: number }> {
  const port = await page.getByTestId('pasteboard-scroll').boundingBox()
  if (port === null) throw new Error('no pasteboard')
  return { x: port.x + port.width / 2, y: port.y + port.height / 2 }
}
