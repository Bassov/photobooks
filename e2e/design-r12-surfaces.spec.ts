import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Owner Musts M75, M79, M80, round 12, relayed by the Designer (review r11 of
// prod, 2026-11-02). Owner rule: every Designer item is a Must; round 12,
// Designer review r11 2026-11-02. Kit values measured on the rendered kit
// `uikit#/demo` at 1440 × 900 with getBoundingClientRect / getComputedStyle /
// Range rects, replaying the demo-capture steps (19 × 23 cm "Lake trip").
//
// M75 editor-cover-photo-and-title: the cover text inherits line-height 1.5.
//     `cover-front-text` box 51 px high (line-height 51px), its text 43 px
//     high, 4 px under the box top; `cover-back-text` box 16.5 px (16.5px),
//     text 14 px, 1 px under the box top. On the Designer's cover rect (y
//     149.22, see design-r11-canvas) the front text top is 197.98 and the back
//     text top 581.52. Unitless, so the boxes keep their ratio to the cover.
// M79 editor-spread-1 (spread 2–3 selected): list card (kit MiniSpread)
//     x 20, 180 × 108.94, white, border-radius 2px, box-shadow
//     rgba(0, 0, 0, 0.14) 0px 1px 2px 0px (kit computed value also lists four
//     transparent ring layers). Page 1 is the same card clipped at 50 %, so
//     its page (x 110, 90 wide) carries the card values; the last page is the
//     kit LastPage: x 20, 90 wide, rgba(35, 34, 35, 0.18) 0px 1px 2px 0px,
//     border-radius 0px. Cover / Endpaper minis keep shadowSm (M74).
// M80 popovers, border 1px solid rgba(0, 0, 0, 0) on all sides, offset 4:
//     library-sort-menu x 1198, y 50, 176 wide; library-book-menu ("Lake
//     trip") x 179.39, y 476, 176 wide; create-book-size-menu x 514, y 470,
//     412 wide.

const KIT = {
  cover: { y: 149.22, width: 848 },
  front: { box: 51, lineHeight: '51px', text: 43, inset: 4, textY: 197.98 },
  back: { box: 16.5, lineHeight: '16.5px', text: 14, inset: 1, textY: 581.52 },
  card: {
    x: 20,
    width: 180,
    half: 90,
    height: 108.94,
    radius: '2px',
    shadow: 'rgba(0, 0, 0, 0.14) 0px 1px 2px 0px',
    paper: 'rgb(255, 255, 255)',
  },
  lastPage: { shadow: 'rgba(35, 34, 35, 0.18) 0px 1px 2px 0px', radius: '0px' },
  border: { width: '1px', style: 'solid', color: 'rgba(0, 0, 0, 0)' },
  sortMenu: { x: 1198, y: 50, width: 176 },
  bookMenu: { x: 179.39, y: 476, width: 176 },
  sizeMenu: { x: 514, y: 470, width: 412 },
} as const

const FRONT_TITLE = 'Lake trip 2026'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${String(actual)}`,
  ).toBeLessThanOrEqual(0.5)
}

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

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

interface TextRead {
  box: Rect
  textY: number
  textHeight: number
  lineHeight: string
}

interface CoverTextRead {
  cover: Rect
  front: TextRead
  back: TextRead
}

/** Cover rect and the front / back text boxes with their Range rects. */
async function readCoverText(page: Page): Promise<CoverTextRead> {
  return page.evaluate(() => {
    const byId = (id: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      if (!el) throw new Error(`missing ${id}`)
      return el
    }
    const rect = (r: DOMRect) => ({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    })
    const read = (el: HTMLElement) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const text = range.getBoundingClientRect()
      return {
        box: rect(el.getBoundingClientRect()),
        textY: text.y,
        textHeight: text.height,
        lineHeight: getComputedStyle(el).lineHeight,
      }
    }
    return {
      cover: rect(byId('canvas-cover').getBoundingClientRect()),
      front: read(byId('cover-front-text')),
      back: read(byId('cover-back-text')),
    }
  })
}

async function openCover(page: Page): Promise<void> {
  await page.getByTestId('cover-list-item').click()
  const title = page.getByTestId('cover-text-front')
  await title.fill(FRONT_TITLE)
  await title.blur()
  await expect(page.getByTestId('cover-front-text')).toHaveText(FRONT_TITLE)
  await page.mouse.move(1439, 899)
  await page.evaluate(async (text) => {
    await document.fonts.load('italic 400 34px "Lora Cover"', text)
    await document.fonts.ready
  }, FRONT_TITLE)
}

test.describe('M75: cover text boxes take the kit line-height', () => {
  test.beforeEach(async ({ page }) => {
    await openLakeTrip(page)
    await openCover(page)
  })

  test('at Fit: front and back text sit at the kit y', async ({ page }) => {
    await expect(page.getByTestId('cover-front-text')).toHaveCSS(
      'line-height',
      KIT.front.lineHeight,
    )
    await expect(page.getByTestId('cover-back-text')).toHaveCSS(
      'line-height',
      KIT.back.lineHeight,
    )
    const read = await readCoverText(page)
    near(read.cover.y, KIT.cover.y, 'cover y')
    near(read.cover.width, KIT.cover.width, 'cover width')

    near(read.front.box.height, KIT.front.box, 'front box height')
    near(read.front.textHeight, KIT.front.text, 'front text height')
    near(read.front.textY - read.front.box.y, KIT.front.inset, 'front inset')
    near(read.front.textY, KIT.front.textY, 'front text y')

    near(read.back.box.height, KIT.back.box, 'back box height')
    near(read.back.textHeight, KIT.back.text, 'back text height')
    near(read.back.textY - read.back.box.y, KIT.back.inset, 'back inset')
    near(read.back.textY, KIT.back.textY, 'back text y')
  })

  test('at ×2 cover size: boxes keep their ratio, text stays centred', async ({
    page,
  }) => {
    const fit = await readCoverText(page)
    await page.setViewportSize({ width: 2880, height: 1800 })
    await expect
      .poll(async () => (await readCoverText(page)).cover.width)
      .toBeGreaterThan(fit.cover.width * 1.9)
    const big = await readCoverText(page)
    const scale = big.cover.width / KIT.cover.width
    near(big.front.box.height, KIT.front.box * scale, 'front box ×2')
    near(big.back.box.height, KIT.back.box * scale, 'back box ×2')
    // Box tops follow the cover; the glyph box rounds per font size, so the
    // text is checked as centred in its line box (the kit 4 / 1 px at Fit).
    near(
      big.front.box.y - big.cover.y,
      (fit.front.box.y - fit.cover.y) * scale,
      'front box top ×2',
    )
    near(
      big.back.box.y - big.cover.y,
      (fit.back.box.y - fit.cover.y) * scale,
      'back box top ×2',
    )
    near(
      big.front.textY - big.front.box.y,
      (big.front.box.height - big.front.textHeight) / 2,
      'front text centred ×2',
    )
    near(
      big.back.textY - big.back.box.y,
      (big.back.box.height - big.back.textHeight) / 2,
      'back text centred ×2',
    )
    expect(big.front.box.height / big.cover.width, 'front ratio').toBeCloseTo(
      KIT.front.box / KIT.cover.width,
      3,
    )
    expect(big.back.box.height / big.cover.width, 'back ratio').toBeCloseTo(
      KIT.back.box / KIT.cover.width,
      3,
    )
  })
})

const listRows = (page: Page): Locator =>
  page.locator('[data-testid^="spread-list-item-"]')

async function box(el: Locator): Promise<Rect> {
  const r = await el.boundingBox()
  if (!r) throw new Error('no box')
  return r
}

async function expectCard(card: Locator, at: string): Promise<void> {
  await expect(card, at).toHaveCSS('box-shadow', KIT.card.shadow)
  await expect(card, at).toHaveCSS('border-radius', KIT.card.radius)
}

test.describe('M79: spread-list page cards are the kit card', () => {
  test('spread rows, page 1 and the last page, selected and at rest', async ({
    page,
  }) => {
    await openLakeTrip(page)
    await listRows(page).nth(1).click()
    await page.mouse.move(700, 450)
    const rows = listRows(page)
    const last = (await rows.count()) - 1
    expect(last).toBeGreaterThanOrEqual(2)

    // Selected spread (kit editor-spread-1) and a spread at rest.
    for (const i of [1, 2].filter((n) => n < last)) {
      const thumb = rows.nth(i).locator('.editor-spread-thumb')
      await expectCard(thumb, `row ${String(i)}`)
      await expect(thumb.locator('.spread-view')).toHaveCSS(
        'background-color',
        KIT.card.paper,
      )
      const r = await box(thumb)
      near(r.x, KIT.card.x, `row ${String(i)} x`)
      near(r.width, KIT.card.width, `row ${String(i)} width`)
      near(r.height, KIT.card.height, `row ${String(i)} height`)
    }
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true')

    // Page 1: the card clipped to its right half.
    const first = rows.nth(0).locator('.spread-view')
    await expectCard(first, 'page 1')
    await expect(rows.nth(0).locator('.editor-spread-thumb')).toHaveCSS(
      'box-shadow',
      'none',
    )
    const p1 = await box(first)
    near(p1.x, KIT.card.x + KIT.card.half, 'page 1 x')
    near(p1.width, KIT.card.half, 'page 1 width')
    near(p1.height, KIT.card.height, 'page 1 height')

    // Last page: kit LastPage, shadowSm and square.
    const end = rows.nth(last).locator('.spread-view')
    await expect(end).toHaveCSS('box-shadow', KIT.lastPage.shadow)
    await expect(end).toHaveCSS('border-radius', KIT.lastPage.radius)
    const pl = await box(end)
    near(pl.x, KIT.card.x, 'last page x')
    near(pl.width, KIT.card.half, 'last page width')

    // Page 1 selected: the same card.
    await rows.nth(0).click()
    await page.mouse.move(700, 450)
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expectCard(first, 'page 1 selected')
  })
})

async function openLibrary(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
}

async function expectPopover(
  popover: Locator,
  kit: { x: number; y: number; width: number },
  at: string,
): Promise<void> {
  await expect(popover, at).toBeVisible()
  for (const side of ['top', 'right', 'bottom', 'left']) {
    await expect(popover, `${at} ${side}`).toHaveCSS(
      `border-${side}-width`,
      KIT.border.width,
    )
    await expect(popover, `${at} ${side}`).toHaveCSS(
      `border-${side}-style`,
      KIT.border.style,
    )
    await expect(popover, `${at} ${side}`).toHaveCSS(
      `border-${side}-color`,
      KIT.border.color,
    )
  }
  await expect
    .poll(async () => {
      const r = await box(popover)
      return Math.max(
        Math.abs(r.x - kit.x),
        Math.abs(r.y - kit.y),
        Math.abs(r.width - kit.width),
      )
    }, at)
    .toBeLessThanOrEqual(0.5)
}

test.describe('M80: popover menus take the kit border and placement', () => {
  test('library sort and book menus', async ({ page }) => {
    await openLibrary(page)
    await page.getByTestId('lib-sort').click()
    await expectPopover(
      page.locator('.pb-menu-popover', {
        has: page.getByTestId('lib-sort-menu'),
      }),
      KIT.sortMenu,
      'sort menu',
    )
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('lib-sort-menu')).toHaveCount(0)

    await page.locator('[data-testid^="book-menu-"]').first().click({
      force: true,
    })
    await expectPopover(
      page.locator('.pb-menu-popover', {
        has: page.getByRole('menuitem', { name: 'Rename' }),
      }),
      KIT.bookMenu,
      'book menu',
    )
  })

  test('create-book size list', async ({ page }) => {
    await openLibrary(page)
    await page.getByTestId('new-book').click()
    await expect(page.getByTestId('create-book-dialog')).toBeVisible()
    await page.getByTestId('create-preset').click()
    await expectPopover(
      page.locator('.pb-list-select__popover'),
      KIT.sizeMenu,
      'size menu',
    )
  })
})
