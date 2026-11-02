import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openLibraryBook } from './fixtures/openLibraryBook'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Owner Musts M80 and M81, round 13, relayed by the Designer (review r12 of
// prod, 2026-11-02). Owner rule: every Designer item is a Must; round 13,
// Designer review r12 2026-11-02. Kit values measured on the rendered kit
// `uikit#/demo` (v0.10.0) at 1440 × 900 with getBoundingClientRect /
// getComputedStyle after replaying the demo-capture steps.
//
// M80 `library-book-menu` ("Lake trip"): the open "Book actions" trigger is
//     x 327.39, y 444, 28 × 28, transform none (the kit Button has no press
//     scale); the menu is x 179.39, y 476, 176 wide, 4.00 below the trigger;
//     item text "Open" y 488, "Rename" y 518.84. Every other open menu
//     trigger is transform none as well (spread-list page actions, Zoom).
// M81 `editor-frame-selected`, Caption expanded: hint "Printed 1.5 mm under
//     the frame, Caption style" is a DIV, margin 6px 0px 0px, line-height
//     16.8px; the Position & size header (and its title) sits 121.8 below
//     the CAPTION header.

const KIT = {
  trigger: { x: 327.39, y: 444, width: 28, height: 28 },
  bookMenu: { x: 179.39, y: 476, width: 176 },
  gap: 4,
  items: { Open: 488, Rename: 518.84 },
  transform: 'none',
  hint: { tag: 'DIV', margin: '6px 0px 0px', lineHeight: '16.8px' },
  nextHeader: 121.8,
} as const

const HINT = 'Printed 1.5 mm under the frame, Caption style'

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what} ${String(actual)} vs kit ${String(expected)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function box(el: Locator) {
  const b = await el.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

/** Top of the first text node in `el` (the Designer's text-leaf y). */
async function textTop(el: Locator): Promise<number> {
  return el.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: (t) =>
        (t.textContent ?? '').trim() === ''
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    })
    const text = walker.nextNode()
    if (text === null) throw new Error('no text')
    const range = document.createRange()
    range.selectNodeContents(text)
    return range.getBoundingClientRect().y
  })
}

const menuPopover = (page: Page, item: string): Locator =>
  page.locator('.pb-menu-popover', {
    has: page.getByRole('menuitem', { name: item, exact: true }),
  })

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

test.describe('M80: an open menu trigger keeps the kit size', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
  })

  test('library book menu: trigger unscaled, menu at the kit top', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const api = window.__photobooksProject
      if (!api) throw new Error('missing api')
      await api.leaveEditorForLibrary()
    })
    await expect(page.getByTestId('library-screen')).toBeVisible({
      timeout: 15_000,
    })
    const trigger = page.getByRole('button', { name: 'Book actions' }).first()
    await trigger.click({ force: true })
    const menu = menuPopover(page, 'Rename')
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.mouse.move(0, 899)

    await expect(trigger).toHaveCSS('transform', KIT.transform)
    await expect
      .poll(async () => {
        const t = await box(trigger)
        const m = await box(menu)
        return Math.max(
          Math.abs(t.x - KIT.trigger.x),
          Math.abs(t.y - KIT.trigger.y),
          Math.abs(t.width - KIT.trigger.width),
          Math.abs(t.height - KIT.trigger.height),
          Math.abs(m.x - KIT.bookMenu.x),
          Math.abs(m.y - KIT.bookMenu.y),
          Math.abs(m.width - KIT.bookMenu.width),
        )
      }, 'trigger and menu boxes vs kit')
      .toBeLessThanOrEqual(0.5)
    const t = await box(trigger)
    const m = await box(menu)
    near(m.y - (t.y + t.height), KIT.gap, 'gap from the trigger')
    for (const [name, y] of Object.entries(KIT.items)) {
      near(
        await textTop(page.getByRole('menuitem', { name, exact: true })),
        y,
        `${name} text y`,
      )
    }
  })

  test('spread-list page actions and Zoom triggers stay unscaled while open', async ({
    page,
  }) => {
    const rowMenu = page.locator('[data-testid^="spread-menu-"]').first()
    await rowMenu.click({ force: true })
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(rowMenu).toHaveAttribute('aria-expanded', 'true')
    await page.mouse.move(0, 899)
    await expect(rowMenu).toHaveCSS('transform', KIT.transform)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)

    const zoom = page.getByTestId('zoom-menu')
    const rest = await box(zoom)
    await zoom.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(zoom).toHaveAttribute('aria-expanded', 'true')
    await page.mouse.move(0, 899)
    await expect(zoom).toHaveCSS('transform', KIT.transform)
    const open = await box(zoom)
    near(open.width, rest.width, 'Zoom trigger width open')
    near(open.height, rest.height, 'Zoom trigger height open')
  })

  test('a plain button keeps the short press scale while held', async ({
    page,
  }) => {
    const zoomIn = page.getByTestId('zoom-in')
    const b = await box(zoomIn)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await expect(zoomIn).toHaveCSS(
      'transform',
      'matrix(0.98, 0, 0, 0.98, 0, 0)',
    )
    await page.mouse.move(0, 899)
    await page.mouse.up()
    await expect(zoomIn).toHaveCSS('transform', KIT.transform)
  })
})

test.describe('M81: the Caption section is the kit height', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test('expanded Caption: kit hint box and next header offset', async ({
    page,
  }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 60_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0)
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')

    const caption = page.getByTestId('inspector-caption-disclosure')
    const geometry = page.getByTestId('inspector-geometry-disclosure')
    const header = (d: Locator) => d.locator('.pb-disclosure__trigger')
    const title = (d: Locator) =>
      d.locator('.pb-disclosure__trigger .inspector-eyebrow')
    await header(caption).click()
    await expect(header(caption)).toHaveAttribute('aria-expanded', 'true')
    await expect(header(geometry)).toHaveAttribute('aria-expanded', 'false')
    await page.mouse.move(0, 899)

    const hint = caption.getByText(HINT)
    await hint.scrollIntoViewIfNeeded()
    expect(
      await hint.evaluate((el) => {
        const s = getComputedStyle(el)
        return { tag: el.tagName, margin: s.margin, lineHeight: s.lineHeight }
      }),
    ).toEqual(KIT.hint)
    near(
      (await box(header(geometry))).y - (await box(header(caption))).y,
      KIT.nextHeader,
      'Position & size header dy',
    )
    near(
      (await box(title(geometry))).y - (await box(title(caption))).y,
      KIT.nextHeader,
      'Position & size title dy',
    )
  })
})
