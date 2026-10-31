import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet, addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { zoomOutToFloor } from './fixtures/stackGap'
import { chooseZoom } from './fixtures/zoomMenu'

// Designer round 4 (2026-10-31, NOT PASS on prod 5e6e242). Kit values were
// measured on the rendered kit `uikit#/demo` (v0.10.0) at 1440 × 900 with the
// same DOM reads as below (getBoundingClientRect / getComputedStyle):
//
// M38 step 17 status pill: canvas left + 12 = x 224, canvas bottom − 12,
//     h 24.8 (4 px + 16.8 px line + 4 px), 12 px font, 8 px radius,
//     w 456 for the hint text, rgb(83, 81, 82).
// M39 canvas area (panel-l right 212, panel-r left 1140) centre = 676; the kit
//     group with Snap + Grid is 210 wide (4-tool segment 138 + 2 × (4 + 32));
//     closing the kit inspector leaves the group where it is (679 → 679).
// M40 menu rows 30.84 px (6 px + 13 px × 1.45 + 6 px), pitch 30.84; library
//     sort menu (3 rows) 100.53 tall, book menu (4 rows + separator) 140.38.
// M41 single-choice marker: 8 × 8 dot, item left + 12, item top + 11.42
//     (vertically centred), filled with the item ink rgb(57, 55, 56).
// M42 Designer-accepted deviation: page numbers hidden when the gap cannot
//     hold 8 px + the 11 px label.

const KIT = {
  pill: { inset: 12, height: 24.8, font: '12px', radius: '8px', width: 456 },
  pillInk: 'rgb(83, 81, 82)',
  canvasCentre: 676,
  groupWidth: 210,
  row: 30.84375,
  sortMenu: 100.53125,
  bookMenu: 140.375,
  dot: { size: 8, left: 12, top: 11.421875 },
  ink: 'rgb(57, 55, 56)',
} as const

const HINT =
  'Drag onto another frame to swap, or onto the filmstrip to take the photo back'

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

async function rectOf(locator: Locator): Promise<Rect> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    }
  })
}

function near(actual: number, expected: number, tolerance: number): void {
  expect(
    Math.abs(actual - expected),
    `${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(tolerance)
}

test.beforeAll(() => {
  // Generate the PNG only when missing: workers race on rewrites.
  if (!existsSync(photoFixturePaths.samplePng)) {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  }
})

test.describe('M38 drag-hint pill while a photo frame is dragged', () => {
  interface PillRead {
    pill: string | null
    text: string
    rect: Rect
    font: string
    radius: string
    color: string
  }

  async function readPill(page: Page): Promise<PillRead> {
    const status = page.getByTestId('editor-status')
    return status.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        pill: el.getAttribute('data-pill'),
        text: el.textContent,
        rect: {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        },
        font: cs.fontSize,
        radius: cs.borderTopLeftRadius,
        color: cs.color,
      }
    })
  }

  async function expectKitPill(page: Page): Promise<void> {
    const canvas = await rectOf(page.getByTestId('canvas'))
    const read = await readPill(page)
    expect(read.pill).toBe('true')
    expect(read.text).toBe(HINT)
    await expect(page.getByTestId('editor-status')).toBeVisible()
    near(read.rect.left - canvas.left, KIT.pill.inset, 1)
    near(canvas.bottom - read.rect.bottom, KIT.pill.inset, 1)
    near(read.rect.left, 224, 1)
    near(read.rect.height, KIT.pill.height, 1)
    near(read.rect.width, KIT.pill.width, 1)
    expect(read.font).toBe(KIT.pill.font)
    expect(read.radius).toBe(KIT.pill.radius)
    expect(read.color).toBe(KIT.pillInk)
  }

  async function expectNoPill(page: Page): Promise<void> {
    const read = await readPill(page)
    expect(read.pill).toBeNull()
    expect(read.text).not.toBe(HINT)
    // The live region stays a 1 px clipped node: nothing painted.
    expect(read.rect.width).toBeLessThanOrEqual(1)
    expect(read.rect.height).toBeLessThanOrEqual(1)
  }

  /** Kit steps 15–16: a dropped photo, then a click on its (selected) frame. */
  async function placedAndSelected(page: Page): Promise<Locator> {
    await page.setViewportSize({ width: 1440, height: 900 })
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await applyContactSheet(page, 2, 2)
    await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
    const frame = page.locator(
      '[data-testid="spread-frame"][data-filled="true"]',
    )
    await expect(frame).toHaveCount(1, { timeout: 30_000 })
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await expectNoPill(page)
    return frame
  }

  async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
    const r = await rectOf(locator)
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  test('step 17: the selected frame drags with the kit pill; release clears it', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const frame = await placedAndSelected(page)
    const before = await rectOf(frame)
    const { x, y } = await centreOf(frame)

    // The kit capture: down on the frame, six moves over the canvas.
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(x - 10 * i, y + 6 * i)
    }
    await expectKitPill(page)
    // A photo drag, not a frame move: the frame stays put.
    const mid = await rectOf(frame)
    near(mid.left, before.left, 0.5)
    near(mid.top, before.top, 0.5)

    // Back onto itself and release: a no-op drop, the pill is gone.
    await page.mouse.move(x, y, { steps: 4 })
    await page.mouse.up()
    await expect.poll(async () => (await readPill(page)).pill).toBeNull()
    await expectNoPill(page)
    await expect(frame).toHaveCount(1)
  })

  test('the pill holds over another frame and over the filmstrip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const frame = await placedAndSelected(page)
    const { x, y } = await centreOf(frame)
    const other = page
      .locator('[data-testid="spread-frame"][data-filled="false"]')
      .first()
    const target = await centreOf(other)
    const strip = await rectOf(page.getByTestId('filmstrip'))

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, { steps: 8 })
    await expectKitPill(page)
    await page.mouse.move(strip.left + strip.width / 2, strip.top + 20, {
      steps: 8,
    })
    await expectKitPill(page)

    // Released on the filmstrip: the photo goes back, the hint is gone.
    await page.mouse.up()
    await expect(
      page.locator('[data-testid="spread-frame"][data-filled="true"]'),
    ).toHaveCount(0)
    await expectNoPill(page)
    await assertDocumentFitsViewport(page)
  })

  test('an unselected filled frame shows the same pill', async ({ page }) => {
    test.setTimeout(120_000)
    const frame = await placedAndSelected(page)
    await page.keyboard.press('Escape')
    await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
    const { x, y } = await centreOf(frame)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 40, y + 40, { steps: 6 })
    await expectKitPill(page)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expectNoPill(page)
  })
})

test.describe('M39 tool group centred on the canvas area', () => {
  /** Union of what the tool group paints (its laid-out children). */
  async function groupSpan(page: Page): Promise<Rect> {
    return page
      .getByRole('toolbar', { name: 'Editor' })
      .locator(':scope > *')
      .evaluateAll((els) => {
        const boxes = els
          .map((el) => el.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.height > 0)
        const left = Math.min(...boxes.map((b) => b.left))
        const right = Math.max(...boxes.map((b) => b.right))
        const top = Math.min(...boxes.map((b) => b.top))
        const bottom = Math.max(...boxes.map((b) => b.bottom))
        return {
          left,
          right,
          top,
          bottom,
          width: right - left,
          height: bottom - top,
        }
      })
  }

  test('1440 × 900, inspector open: centre between the panels, kit width; it stays when the inspector closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await expect(page.getByTestId('panel-r')).toHaveAttribute(
      'data-open',
      'true',
    )
    const left = await rectOf(page.getByTestId('panel-l'))
    const inspector = await rectOf(page.getByTestId('panel-r'))
    expect(inspector.width).toBe(300)
    const group = await groupSpan(page)
    const centre = (group.left + group.right) / 2
    near(centre, (left.right + inspector.left) / 2, 1)
    near(centre, KIT.canvasCentre, 1)
    near(group.width, KIT.groupWidth, 1)
    // Clear of the history and zoom groups on one row.
    expect(group.left).toBeGreaterThan(
      (await rectOf(page.getByTestId('redo'))).right,
    )
    expect(group.right).toBeLessThan(
      (await rectOf(page.getByTestId('zoom-out'))).left,
    )
    expect(group.height).toBeLessThanOrEqual(36)
    // Empty book: the grid bar adds no page-level scroll.
    await assertDocumentFitsViewport(page)

    // Kit: hiding the inspector does not move the group.
    await page.getByTestId('toggle-r').click()
    await expect(page.getByTestId('panel-r')).toHaveAttribute(
      'data-open',
      'false',
    )
    await expect
      .poll(async () => (await rectOf(page.getByTestId('panel-r'))).width)
      .toBe(0)
    const closed = await groupSpan(page)
    near((closed.left + closed.right) / 2, centre, 0.5)
  })

  test('follows a resized left panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    const splitter = page.getByRole('separator', { name: 'Resize left panel' })
    await splitter.focus()
    await page.keyboard.press('Shift+ArrowRight')
    const left = await rectOf(page.getByTestId('panel-l'))
    expect(left.width).toBe(244)
    const inspector = await rectOf(page.getByTestId('panel-r'))
    const group = await groupSpan(page)
    near((group.left + group.right) / 2, (left.right + inspector.left) / 2, 1)
  })
})

test.describe('M40/M41 kit menu rows and the sort dot', () => {
  interface MenuRead {
    menuHeight: number
    rows: { top: number; height: number; checked: string | null }[]
    checks: number
    markers: {
      row: number
      dx: number
      dy: number
      width: number
      height: number
      fill: string
      icon: string | null
    }[]
    ink: string
  }

  async function readMenu(menu: Locator): Promise<MenuRead> {
    return menu.evaluate((el) => {
      const items = [...el.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
      const rows = items.map((item) => {
        const r = item.getBoundingClientRect()
        return {
          top: r.top,
          height: r.height,
          checked: item.getAttribute('aria-checked'),
        }
      })
      const markers = items.flatMap((item, row) => {
        const svg = item.querySelector<SVGElement>('.pb-menu-item__check svg')
        if (svg === null) return []
        const r = svg.getBoundingClientRect()
        const ir = item.getBoundingClientRect()
        return [
          {
            row,
            dx: r.left - ir.left,
            dy: r.top - ir.top,
            width: r.width,
            height: r.height,
            fill: getComputedStyle(svg).fill,
            icon: svg.getAttribute('data-icon'),
          },
        ]
      })
      return {
        menuHeight: el.getBoundingClientRect().height,
        rows,
        checks: el.querySelectorAll('[data-icon="check"]').length,
        markers,
        ink: items[0] ? getComputedStyle(items[0]).color : '',
      }
    })
  }

  function expectKitRows(read: MenuRead, separators: number[] = []): void {
    expect(read.rows.length).toBeGreaterThan(0)
    for (const row of read.rows) {
      near(row.height, KIT.row, 0.5)
      near(row.height, 31, 0.5)
    }
    read.rows.slice(1).forEach((row, i) => {
      const prev = read.rows[i]
      if (prev === undefined) throw new Error('missing row')
      // Kit separator: 1 px + my-1.
      const extra = separators.includes(i + 1) ? 9 : 0
      near(row.top - prev.top, KIT.row + extra, 0.5)
    })
  }

  function expectKitDot(read: MenuRead): void {
    expect(read.checks).toBe(0)
    const checked = read.rows.flatMap((row, i) =>
      row.checked === 'true' ? [i] : [],
    )
    expect(checked).toHaveLength(1)
    expect(read.markers).toHaveLength(1)
    const [dot] = read.markers
    expect(dot?.row).toBe(checked[0])
    expect(dot?.icon).toBe('circle')
    near(dot?.width ?? 0, KIT.dot.size, 1)
    near(dot?.height ?? 0, KIT.dot.size, 1)
    near(dot?.dx ?? 0, KIT.dot.left, 1)
    near(dot?.dy ?? 0, KIT.dot.top, 1)
    expect(dot?.fill).toBe(KIT.ink)
    expect(read.ink).toBe(KIT.ink)
    for (const row of read.rows) {
      expect(['true', 'false']).toContain(row.checked)
    }
  }

  test('step 42 book menu and step 45 sort menu: 31 px rows, kit heights, a dot', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await page.getByTestId('go-library').click()

    const sort = page.getByTestId('lib-sort')
    await expect(sort).toBeVisible({ timeout: 15_000 })
    await sort.click()
    const sortMenu = page.getByTestId('lib-sort-menu')
    await expect(sortMenu).toBeVisible()
    const sortRead = await readMenu(sortMenu)
    expect(sortRead.rows).toHaveLength(3)
    expectKitRows(sortRead)
    near(sortRead.menuHeight, KIT.sortMenu, 0.5)
    expectKitDot(sortRead)
    // Another choice moves the dot with aria-checked.
    await page.getByRole('menuitemradio', { name: 'Title' }).click()
    await expect(sortMenu).toHaveCount(0)
    await sort.click()
    const moved = await readMenu(page.getByTestId('lib-sort-menu'))
    expect(moved.rows[1]?.checked).toBe('true')
    expectKitDot(moved)
    expect(moved.markers[0]?.row).toBe(1)
    await page.keyboard.press('Escape')

    const book = page.locator('button[data-testid^="book-menu-"]').first()
    await book.hover()
    await book.click()
    const bookMenu = page.getByRole('menu')
    await expect(bookMenu).toBeVisible()
    const bookRead = await readMenu(bookMenu)
    expect(bookRead.rows).toHaveLength(4)
    expectKitRows(bookRead, [3])
    near(bookRead.menuHeight, KIT.bookMenu, 0.5)
    expect(bookRead.markers).toHaveLength(0)
  })

  test('filmstrip sort menu: 31 px rows and the kit dot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await page.getByTestId('film-sort').click()
    const menu = page.getByTestId('film-sort-menu')
    await expect(menu).toBeVisible()
    const read = await readMenu(menu)
    expect(read.rows).toHaveLength(3)
    expectKitRows(read)
    near(read.menuHeight, KIT.sortMenu, 0.5)
    expectKitDot(read)
  })
})

test.describe('M42 page numbers at the zoom floor (Designer-accepted deviation)', () => {
  interface LabelSample {
    gesture: boolean
    labels: { dy: number; fontPx: number; opacity: string; gap: number }[]
    gaps: number[]
  }

  /**
   * Screen-px read of the mounted stack: each painted page number's offset
   * under its spread, its font in screen px (computed size × live scale),
   * its opacity and the gap below its spread.
   */
  function sampleLabels(): LabelSample {
    const slots = [
      ...document.querySelectorAll<HTMLElement>('[data-pasteboard-slot]'),
    ]
    const views = slots.map((slot) =>
      slot.querySelector<HTMLElement>('[data-testid="spread-view"]'),
    )
    const gaps = views.slice(1).flatMap((view, i) => {
      const prev = views[i]
      if (!view || !prev) return []
      return [
        view.getBoundingClientRect().top - prev.getBoundingClientRect().bottom,
      ]
    })
    const labels = slots.flatMap((slot, i) => {
      const view = views[i]
      if (!view) return []
      const box = view.getBoundingClientRect()
      const scale = box.height / view.offsetHeight
      const next = views[i + 1]?.getBoundingClientRect().top
      return [...slot.querySelectorAll<HTMLElement>('.page-label')]
        .filter((label) => {
          const r = label.getBoundingClientRect()
          return label.textContent !== '' && r.width > 0 && r.height > 0
        })
        .map((label) => {
          const r = label.getBoundingClientRect()
          let opacity = 1
          for (
            let el: HTMLElement | null = label;
            el !== null && el !== slot.parentElement;
            el = el.parentElement
          ) {
            opacity *= Number(getComputedStyle(el).opacity)
          }
          return {
            dy: r.top - box.bottom,
            fontPx: Number.parseFloat(getComputedStyle(label).fontSize) * scale,
            opacity: String(opacity),
            gap:
              next === undefined ? Number.POSITIVE_INFINITY : next - box.bottom,
          }
        })
    })
    const world = document.querySelector<HTMLElement>(
      '[data-testid="pasteboard-world"]',
    )
    return { gesture: world?.dataset.gesture === 'zoom', labels, gaps }
  }

  function expectExactOrAbsent(sample: LabelSample): void {
    for (const label of sample.labels) {
      near(label.dy, 8, 0.5)
      near(label.fontPx, 11, 0.05)
      expect(label.opacity).toBe('1')
      // Shown only when the gap holds 8 px + the 11 px label.
      expect(label.gap).toBeGreaterThanOrEqual(19 - 0.5)
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    const count = Number(
      await page
        .getByTestId('pasteboard-scroll')
        .getAttribute('data-spread-count'),
    )
    await addSpreads(page, Math.max(0, 3 - count))
    await chooseZoom(page, 'Fit spread')
    await expect
      .poll(() =>
        page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
      )
      .toBeNull()
  })

  test('none at the floor, 8 px / 11 px at Fit', async ({ page }) => {
    const fit = await page.evaluate(sampleLabels)
    expect(fit.labels.length).toBeGreaterThan(0)
    expectExactOrAbsent(fit)

    await zoomOutToFloor(page)
    await expect
      .poll(() =>
        page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
      )
      .toBeNull()
    const floor = await page.evaluate(sampleLabels)
    expect(floor.gaps.length).toBeGreaterThan(0)
    for (const gap of floor.gaps) expect(gap).toBeLessThan(19)
    expect(floor.labels).toHaveLength(0)
    await expect(page.getByTestId('page-labels')).toHaveCount(0)
  })

  test('8 wheel steps out then in: every label is absent or exactly 8 px / 11 px', async ({
    page,
  }) => {
    await page.evaluate(`window.__sampleLabels = ${sampleLabels.toString()}`)
    const samples = await page
      .getByTestId('pasteboard-scroll')
      .evaluate(async (scroll) => {
        const sample = (
          window as unknown as { __sampleLabels: () => LabelSample }
        ).__sampleLabels
        const r = scroll.getBoundingClientRect()
        const frame = (): Promise<void> =>
          new Promise((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        const out: LabelSample[] = []
        for (const deltaY of [...Array(8).fill(160), ...Array(8).fill(-160)]) {
          scroll.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: deltaY as number,
              ctrlKey: true,
              clientX: r.x + r.width / 2,
              clientY: r.y + r.height / 3,
              bubbles: true,
              cancelable: true,
            }),
          )
          await frame()
          out.push(sample())
        }
        return out
      })
    expect(samples).toHaveLength(16)
    // The walk crosses the threshold both ways mid-gesture.
    expect(samples.some((s) => s.gesture)).toBe(true)
    expect(samples.some((s) => s.labels.length === 0)).toBe(true)
    expect(samples.some((s) => s.labels.length > 0)).toBe(true)
    for (const sample of samples) expectExactOrAbsent(sample)
  })
})
