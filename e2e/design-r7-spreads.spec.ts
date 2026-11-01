import type { Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  STACK_GAP_RATIO,
  readGapRatios,
  spreadBoxes,
  zoomOutToFloor,
} from './fixtures/stackGap'
import { chooseZoom } from './fixtures/zoomMenu'

// Owner Musts, round 7, relayed by Designer 2026-11-01 (prod 68639a0).
// Kit values measured on the rendered kit `uikit#/demo` (v0.10.0) at
// 1440 × 900, 19 × 23 cm "Lake trip", with getBoundingClientRect:
//
// M45 canvas (Viewport at Fit): spread slot x 252, y 141.36, 848 × 513.25.
//     Page 1 = SpreadSurface clipped `inset(-60px -60px -60px 50%)`: paper
//     x 676, 424 × 513.25, page shadow on it; the left half has no paper.
//     Last page = LastPage: paper x 252, 424 × 513.25 (shadow), right half
//     empty. Page labels: "1" spans the right half (x 676, w 424), the last
//     number the left half (x 252, w 424).
//     List card: box x 20, 180 × 108.94 (the spread aspect); page 1 paper
//     x 110, 90 × 108.94 (clip 50 %), label x 110 (padding-left 90 px); last
//     page paper x 20, 90 × 108.94, label x 20.
// M46 list labels: 8-page book 1 · 2–3 · 4–5 · 6–7 · 8, 6-page book
//     1 · 2–3 · 4–5 · 6 (kit `#/demo` after deleting spreads).
// M49 the kit #/demo never renders the stacked pasteboard (`features.stack`
//     is off), so the pill is the kit `GapDrop` source: h-8 (32 px), text-xs
//     (12 px), rounded-lg (8 px), gap-1.5 (6 px), 14 px icon; one line. The
//     stack gap is 104 / 588 (Owner design change, round 7). The pill clears
//     the page numbers (8 px + 11 px) above and below: it shows from a 70 px
//     gap. Fit (848 × 513.25) does not depend on the gap and is unchanged; at
//     Fit the gap is 513.25 × 104 / 588 = 90.78 px, one zoom-out step 72.6 px
//     (the lowest step that still holds the pill), two steps 58.1 px (hidden).

const KIT = {
  slot: { x: 252, y: 141.36, width: 848, height: 513.25 },
  page: { width: 424, height: 513.25 },
  firstPageX: 676,
  lastPageX: 252,
  card: { boxX: 20, boxWidth: 180, boxHeight: 108.94, half: 90 },
  pill: { height: 32, font: '12px', radius: '8px' },
} as const

const TOL = 0.5

const rows = (page: Page) => page.locator('[data-testid^="spread-list-item-"]')

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function near(actual: number, expected: number, tol = TOL): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol)
}

async function openLakeTrip(page: Page, spreads = 3): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  const count = Number(
    await page
      .getByTestId('pasteboard-scroll')
      .getAttribute('data-spread-count'),
  )
  if (spreads > count) {
    await addSpreads(page, spreads - count)
  }
}

interface SlotRead {
  slot: Rect
  page: Rect
  shadow: Rect | null
  labels: (Rect & { text: string })[]
  /** Paper painted outside the page rect inside the slot (none expected). */
  extraPaper: number
}

async function readSlot(page: Page, index: number): Promise<SlotRead> {
  return page.getByTestId('pasteboard-scroll').evaluate((port, at) => {
    const box = (el: Element): Rect => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const slot = port.querySelector(`[data-slot-index="${String(at)}"]`)
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (!(slot instanceof HTMLElement) || !(view instanceof HTMLElement)) {
      throw new Error('slot not mounted')
    }
    const shadow = document.querySelector(
      `[data-testid="pasteboard-page-shadow"][data-spread-id="${slot.dataset.spreadId ?? ''}"]`,
    )
    return {
      slot: box(slot),
      page: box(view),
      shadow: shadow === null ? null : box(shadow),
      labels: [...slot.querySelectorAll('.page-label')].map((label) => ({
        text: label.textContent,
        ...box(label),
      })),
      extraPaper:
        slot.querySelectorAll('[data-testid="spread-view"]').length - 1,
    }
  }, index)
}

/** Click the list row, then Fit spread: the kit canvas shows it at Fit. */
async function showAtFit(page: Page, index: number): Promise<void> {
  await rows(page).nth(index).click()
  await expect
    .poll(() =>
      page
        .getByTestId('pasteboard-scroll')
        .locator(`[data-slot-index="${String(index)}"]`)
        .getAttribute('data-active'),
    )
    .toBe('true')
  await chooseZoom(page, 'Fit spread')
  let prev = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify((await readSlot(page, index)).page)
        const settled = now === prev
        prev = now
        return settled
      },
      { intervals: [150] },
    )
    .toBe(true)
}

interface CardRead {
  label: string
  box: Rect
  paper: Rect
  labelRect: Rect
  side: string | null
}

async function readCard(page: Page, index: number): Promise<CardRead> {
  return rows(page)
    .nth(index)
    .evaluate((row) => {
      const box = (el: Element | null): Rect => {
        if (el === null) throw new Error('missing card part')
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      const thumb = row.querySelector('.editor-spread-thumb')
      const label = row.querySelector('[data-label]')
      return {
        label: label?.textContent ?? '',
        box: box(thumb),
        paper: box(thumb?.querySelector('.spread-view') ?? null),
        labelRect: box(label),
        side: row.getAttribute('data-page-side'),
      }
    })
}

async function listLabels(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((els) =>
    els.map((el) => el.querySelector('[data-label]')?.textContent ?? ''),
  )
}

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a measured element')
  return value
}

test.describe('M45: a single page renders as one page on its side', () => {
  test('canvas: page 1 on the right half, the last page on the left (#/demo rects)', async ({
    page,
  }) => {
    await openLakeTrip(page)
    const last = (await rows(page).count()) - 1

    await showAtFit(page, 0)
    const first = await readSlot(page, 0)
    near(first.slot.x, KIT.slot.x)
    near(first.slot.width, KIT.slot.width)
    near(first.page.x, KIT.firstPageX)
    near(first.page.y, KIT.slot.y)
    near(first.page.width, KIT.page.width)
    near(first.page.height, KIT.page.height)
    expect(first.extraPaper).toBe(0)
    // The shadow is the page's own (no blank partner page).
    expect(first.shadow).not.toBeNull()
    near(first.shadow?.x ?? 0, first.page.x)
    near(first.shadow?.width ?? 0, first.page.width)
    const one = first.labels.find((l) => l.text === '1')
    near(one?.x ?? 0, KIT.firstPageX)
    near(one?.width ?? 0, KIT.page.width)

    await showAtFit(page, last)
    const end = await readSlot(page, last)
    near(end.slot.x, KIT.slot.x)
    near(end.slot.width, KIT.slot.width)
    near(end.page.x, KIT.lastPageX)
    near(end.page.y, KIT.slot.y)
    near(end.page.width, KIT.page.width)
    near(end.page.height, KIT.page.height)
    expect(end.extraPaper).toBe(0)
    near(end.shadow?.x ?? 0, end.page.x)
    near(end.shadow?.width ?? 0, end.page.width)
    const lastNumber = String(last * 2)
    const n = end.labels.find((l) => l.text === lastNumber)
    near(n?.x ?? 0, KIT.lastPageX)
    near(n?.width ?? 0, KIT.page.width)
  })

  test('list: single-page cards keep the spread box with the page on its half', async ({
    page,
  }) => {
    await openLakeTrip(page)
    const last = (await rows(page).count()) - 1
    const middle = await readCard(page, 1)
    near(middle.box.x, KIT.card.boxX)
    near(middle.box.width, KIT.card.boxWidth)
    near(middle.box.height, KIT.card.boxHeight)
    near(middle.paper.width, KIT.card.boxWidth)

    const first = await readCard(page, 0)
    expect(first.side).toBe('right')
    near(first.box.width, KIT.card.boxWidth)
    near(first.box.height, KIT.card.boxHeight)
    near(first.paper.x, KIT.card.boxX + KIT.card.half)
    near(first.paper.y, first.box.y)
    near(first.paper.width, KIT.card.half)
    near(first.paper.height, KIT.card.boxHeight)
    near(first.labelRect.x, KIT.card.boxX + KIT.card.half)

    const end = await readCard(page, last)
    expect(end.side).toBe('left')
    near(end.box.height, KIT.card.boxHeight)
    near(end.paper.x, KIT.card.boxX)
    near(end.paper.width, KIT.card.half)
    near(end.paper.height, KIT.card.boxHeight)
    near(end.labelRect.x, KIT.card.boxX)
    // The empty half shows the panel, not paper.
    const boxBg = await rows(page)
      .nth(last)
      .locator('.editor-spread-thumb')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(boxBg).toBe('rgba(0, 0, 0, 0)')
  })
})

test.describe('M46: spread-list labels', () => {
  test('6-page book: 1 · 2–3 · 4–5 · 6 (kit #/demo)', async ({ page }) => {
    await openLakeTrip(page, 4)
    await expect.poll(() => listLabels(page)).toEqual(['1', '2–3', '4–5', '6'])
  })

  test('8-page book: 1 · 2–3 · 4–5 · 6–7 · 8 (kit #/demo)', async ({
    page,
  }) => {
    await openLakeTrip(page, 5)
    await expect
      .poll(() => listLabels(page))
      .toEqual(['1', '2–3', '4–5', '6–7', '8'])
  })
})

interface PillRead {
  pills: (Rect & {
    insert: number
    whiteSpace: string
    font: string
    radius: string
    lines: number
    hover: string | null
  })[]
  /** Gap under slot `insert - 1`: page bottom → next page top (screen px). */
  gaps: { insert: number; top: number; bottom: number; centreX: number }[]
  labels: Rect[]
}

function readPills(): PillRead {
  const box = (el: Element): Rect => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }
  const port = document.querySelector('[data-testid="pasteboard-scroll"]')
  if (port === null) throw new Error('no pasteboard')
  const pills = [
    ...port.querySelectorAll<HTMLElement>('[data-testid="pasteboard-gap"]'),
  ].map((pill) => {
    const style = getComputedStyle(pill)
    // Line boxes of the label text only (the icon is a separate box).
    const lineTops = new Set(
      [...pill.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .flatMap((node) => {
          const range = document.createRange()
          range.selectNodeContents(node)
          return [...range.getClientRects()]
        })
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => Math.round(r.top + r.height / 2)),
    )
    return {
      ...box(pill),
      insert: Number(pill.dataset.gapInsertIndex),
      whiteSpace: style.whiteSpace,
      font: style.fontSize,
      radius: style.borderTopLeftRadius,
      lines: lineTops.size,
      hover: pill.getAttribute('data-drop-hover'),
    }
  })
  const slots = [
    ...port.querySelectorAll<HTMLElement>('[data-pasteboard-slot]'),
  ]
  const gaps = slots.flatMap((slot) => {
    const index = Number(slot.dataset.slotIndex)
    const view = slot.querySelector('[data-testid="spread-view"]')
    const next = port.querySelector(
      `[data-slot-index="${String(index + 1)}"] [data-testid="spread-view"]`,
    )
    if (view === null || next === null) return []
    const s = slot.getBoundingClientRect()
    return [
      {
        insert: index + 1,
        top: view.getBoundingClientRect().bottom,
        bottom: next.getBoundingClientRect().top,
        centreX: s.x + s.width / 2,
      },
    ]
  })
  const labels = [...port.querySelectorAll<HTMLElement>('.page-label')]
    .filter((label) => label.textContent !== '' && label.offsetParent !== null)
    .map((label) => {
      // The number's own glyph box, not the half it is centred in.
      const range = document.createRange()
      range.selectNodeContents(label)
      const r = range.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  return { pills, gaps, labels }
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

/** Start a filmstrip photo drag and hold it over the gap under slot 0. */
async function holdDragOverFirstGap(page: Page): Promise<void> {
  const gap = (await readGapUnder(page, 0)) ?? { x: 0, y: 0 }
  await page
    .getByTestId('filmstrip-item')
    .first()
    .evaluate(
      (item, { mime, point }) => {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, item.getAttribute('data-asset-id') ?? '')
        item.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        document
          .querySelector('[data-testid="pasteboard-scroll"]')
          ?.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
              clientX: point.x,
              clientY: point.y,
            }),
          )
      },
      { mime: ASSET_DRAG_MIME, point: gap },
    )
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-asset-drag',
    'true',
  )
}

async function endDrag(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true })),
  )
}

/** Screen centre of the gap under slot `index`, once it is on screen. */
async function readGapUnder(
  page: Page,
  index: number,
): Promise<{ x: number; y: number } | null> {
  return page.getByTestId('pasteboard-scroll').evaluate((port, at) => {
    const view = port.querySelector(
      `[data-slot-index="${String(at)}"] [data-testid="spread-view"]`,
    )
    const next = port.querySelector(
      `[data-slot-index="${String(at + 1)}"] [data-testid="spread-view"]`,
    )
    const slot = port.querySelector(`[data-slot-index="${String(at)}"]`)
    if (view === null || next === null || slot === null) return null
    const s = slot.getBoundingClientRect()
    const top = view.getBoundingClientRect().bottom
    const bottom = next.getBoundingClientRect().top
    return { x: s.x + s.width / 2, y: (top + bottom) / 2 }
  }, index)
}

/** Scroll the gap under slot 0 to the port centre (zoomed in it is off screen). */
async function centreFirstGap(page: Page): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate((port) => {
    const slot = port.querySelector('[data-slot-index="0"]')
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (slot == null || view == null) throw new Error('slot 0 not mounted')
    const p = port.getBoundingClientRect()
    const s = slot.getBoundingClientRect()
    port.scrollTop +=
      view.getBoundingClientRect().bottom - (p.top + p.height / 2)
    port.scrollLeft += s.left + s.width / 2 - (p.left + p.width / 2)
  })
  await expect
    .poll(async () => (await readGapUnder(page, 0)) !== null)
    .toBe(true)
}

/** Toolbar zoom steps, each waiting for the painted spread to change. */
async function zoomSteps(page: Page, direction: 'in' | 'out', count: number) {
  for (let i = 0; i < count; i += 1) {
    const before = (await spreadBoxes(page))[0]?.height ?? 0
    await page.getByTestId(direction === 'in' ? 'zoom-in' : 'zoom-out').click()
    await expect
      .poll(async () => (await spreadBoxes(page))[0]?.height ?? 0)
      .not.toBe(before)
  }
}

test.describe('M49: new-spread pill and the 104 / 588 gap', () => {
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
    await showAtFit(page, 0)
  })

  test('one line, constant size, centred in the gap, clear of every page number', async ({
    page,
  }) => {
    const sizes: { width: number; height: number }[] = []
    // Fit, ×3 (five ×1.25 steps) and one step under Fit, the lowest zoom
    // whose gap (72.6 px) still holds the pill.
    for (const [direction, steps] of [
      ['in', 0],
      ['in', 5],
      ['out', 6],
    ] as const) {
      await zoomSteps(page, direction, steps)
      await centreFirstGap(page)
      await holdDragOverFirstGap(page)
      const read = await page.evaluate(readPills)
      const foundPill = read.pills.find((p) => p.insert === 1)
      const foundGap = read.gaps.find((g) => g.insert === 1)
      expect(foundPill).toBeDefined()
      expect(foundGap).toBeDefined()
      const pill = present(foundPill)
      const gap = present(foundGap)
      expect(pill.hover).toBe('true')
      expect(pill.whiteSpace).toBe('nowrap')
      expect(pill.lines).toBe(1)
      expect(pill.font).toBe(KIT.pill.font)
      expect(pill.radius).toBe(KIT.pill.radius)
      near(pill.height, KIT.pill.height)
      near(pill.x + pill.width / 2, gap.centreX)
      near(pill.y + pill.height / 2, (gap.top + gap.bottom) / 2)
      expect(read.labels.length).toBeGreaterThan(0)
      for (const p of read.pills) {
        for (const label of read.labels) {
          expect(intersects(p, label)).toBe(false)
        }
      }
      sizes.push({ width: pill.width, height: pill.height })
      await endDrag(page)
    }
    for (const size of sizes.slice(1)) {
      near(size.width, sizes[0]?.width ?? 0, 0.01)
      near(size.height, sizes[0]?.height ?? 0, 0.01)
    }
  })

  test('hidden when the gap cannot hold it plus the label clearance', async ({
    page,
  }) => {
    // Two steps under Fit the gap is 58 px (< 70): no pill, numbers stay.
    await zoomSteps(page, 'out', 2)
    await holdDragOverFirstGap(page)
    const short = await page.evaluate(readPills)
    expect(short.gaps.length).toBeGreaterThan(0)
    for (const gap of short.gaps) {
      expect(gap.bottom - gap.top).toBeLessThan(70)
    }
    expect(short.pills).toHaveLength(0)
    expect(short.labels.length).toBeGreaterThan(0)
    await endDrag(page)

    await zoomOutToFloor(page)
    await holdDragOverFirstGap(page)
    await expect(page.getByTestId('pasteboard-gap')).toHaveCount(0)
    await endDrag(page)
  })

  test('the gap is 104 / 588 of the spread height at several zooms', async ({
    page,
  }) => {
    expect(STACK_GAP_RATIO).toBe(104 / 588)
    const fit = await readGapRatios(page)
    for (const ratio of fit) near(ratio, 104 / 588, 0.002)
    const boxes = await spreadBoxes(page)
    // Fit is unchanged by the gap: 513.25 tall, gap 90.78.
    near(boxes[0]?.height ?? 0, KIT.page.height)
    for (const [direction, steps] of [
      ['in', 3],
      ['out', 5],
    ] as const) {
      await zoomSteps(page, direction, steps)
      for (const ratio of await readGapRatios(page)) {
        near(ratio, 104 / 588, 0.002)
      }
    }
    await zoomOutToFloor(page)
    for (const ratio of await readGapRatios(page)) {
      expect(Math.abs(ratio / STACK_GAP_RATIO - 1)).toBeLessThanOrEqual(0.02)
    }
  })
})
