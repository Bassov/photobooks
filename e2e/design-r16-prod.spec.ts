import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Owner rule: every Designer item is a Must; round 16, Designer parity r15
// 2026-11-03 (M83, M84, M85). Kit values measured on the rendered kit
// `uikit#/demo` at 1440 × 900 (file:// build, getBoundingClientRect /
// getComputedStyle), "Lake trip", 19 × 23 cm:
//
// M83 (steps editor-photos-added / editor-inspector-book): `book-title` is
//     ONE button holding the title and the size line: y 8, 32 tall, radius
//     8px, padding 6px 10px 0px, gap 8, overflow hidden. Title text at the
//     button x + 10, white-space nowrap; size line at the title's right + 8,
//     nowrap, rgb(83, 81, 82). aria-pressed "false", bg transparent; Book
//     settings open: aria-pressed "true", bg rgb(216, 214, 210).
// M84 (step editor-spread-1): Contact sheet button x 1313, right 1424,
//     111 × 32 (the row's right edge, 1424).
// M85 (step editor-photos-added, p02 800 px): "Low-res" chip at the thumb's
//     left + 4 / top + 4, rgb(132, 85, 16) on rgb(216, 214, 210) (P10
//     field), radius 4px, padding 1px 4px, warning icon 10 × 10 centred
//     vertically, title / aria-label "Low-res".
// P11 (walkthrough-polish-review, Owner Q-21): the chip is always the M85
//     narrow icon-only variant, 18 × 16.84 at every thumb width (the 65.33
//     wide "Low-res" text variant and its < 73.33 switch are gone; no text
//     is painted). The Photos header ends " · N low-res" in the warning ink
//     when N > 0 and says nothing about low-res when N = 0. The kit gets the
//     same rule in uikit/src/sandbox/chrome.tsx (e2e/kit-filmstrip-lowres).

const FIELD = 'rgb(216, 214, 210)'
const FIELD_RGB = [216, 214, 210]
const MUTED = 'rgb(83, 81, 82)'
const WARNING_INK = 'rgb(132, 85, 16)'
const CLEAR = 'rgba(0, 0, 0, 0)'
const TOL = 0.5

const KIT = {
  titleY: 8,
  titleHeight: 32,
  titleRadius: '8px',
  titlePadding: '6px 10px 0px',
  titleTextInset: 10,
  sizeAfterTitle: 8,
  contactX: 1313,
  contactRight: 1424,
  contactWidth: 111,
  contactHeight: 32,
  chipInset: 4,
  chipWidth: 18,
  chipHeight: 16.84,
  chipIcon: 10,
  /** Thumb width under which the old M85 chip went icon-only. */
  oldNarrowThumbMax: 73.33,
}

interface Box {
  x: number
  y: number
  width: number
  height: number
  right: number
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('expected a bounding box')
  return { ...b, right: b.x + b.width }
}

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(TOL)
}

/** Laid-out text runs reading "Low-res" (any case) in the filmstrip. */
function paintedLowResText(page: Page): Promise<number> {
  return page.getByTestId('filmstrip').evaluate((root) => {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let hits = 0
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      if (!/low-res/i.test(n.textContent ?? '')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const painted = [...range.getClientRects()].some(
        (r) => r.width > 0 && r.height > 0,
      )
      if (painted) hits += 1
    }
    return hits
  })
}

/** P11 chip on a wide thumb: 18 × 16.84 at +4/+4, icon only, no text paint. */
async function expectIconOnlyChip(
  page: Page,
  item: Locator,
  chip: Locator,
  size: string,
): Promise<void> {
  const thumb = await box(item.locator('.filmstrip-drag'))
  // Wide thumbs used to show the "Low-res" text variant.
  expect(thumb.width, size).toBeGreaterThan(KIT.oldNarrowThumbMax)
  const c = await box(chip)
  near(c.x, thumb.x + KIT.chipInset, `${size} chip x`)
  near(c.y, thumb.y + KIT.chipInset, `${size} chip y`)
  near(c.width, KIT.chipWidth, `${size} chip width`)
  near(c.height, KIT.chipHeight, `${size} chip height`)
  const icon = await box(chip.locator('svg'))
  near(icon.width, KIT.chipIcon, `${size} icon width`)
  near(icon.height, KIT.chipIcon, `${size} icon height`)
  near(icon.x, c.x + 4, `${size} icon x`)
  near(icon.y + icon.height / 2, c.y + c.height / 2, `${size} icon centre y`)
  // Paint: the right padding column is plain field (no text run starts
  // after the icon), and no "Low-res" text node lays out in the filmstrip.
  const pad = await pixelsAt(chip, [
    { x: 15.5, y: 3 },
    { x: 15.5, y: 8 },
    { x: 15.5, y: 13 },
  ])
  expect(
    pad.map((px) => px.slice(0, 3)),
    `${size} right padding`,
  ).toEqual([FIELD_RGB, FIELD_RGB, FIELD_RGB])
  expect(await paintedLowResText(page), size).toBe(0)
}

async function parkPointer(page: Page): Promise<void> {
  await page.mouse.move(1439, 899)
}

function titleButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Book settings', exact: true })
}

async function lineOf(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      height: el.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(s.lineHeight),
      whiteSpace: s.whiteSpace,
      textOverflow: s.textOverflow,
      truncated: el.scrollWidth > el.clientWidth,
      visibleWidth: el.clientWidth,
    }
  })
}

test.describe('design-r16-prod M83 title bar', () => {
  test('title and size line are one 32 px r8 button, filled and pressed while Book settings is open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await parkPointer(page)
    const button = titleButton(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button.getByTestId('book-title')).toHaveText('Lake trip')
    await expect(button.getByTestId('book-size')).toContainText('19 × 23 cm')

    const look = await button.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        tag: el.tagName,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        padding: s.padding,
        gap: s.columnGap,
        overflow: s.overflow,
      }
    })
    expect(look).toEqual({
      tag: 'BUTTON',
      bg: CLEAR,
      radius: KIT.titleRadius,
      padding: KIT.titlePadding,
      gap: '8px',
      overflow: 'hidden',
    })
    const b = await box(button)
    near(b.y, KIT.titleY, 'title button y')
    near(b.height, KIT.titleHeight, 'title button height')
    const title = await box(page.getByTestId('book-title'))
    const size = await box(page.getByTestId('book-size'))
    near(title.x, b.x + KIT.titleTextInset, 'title text x')
    near(size.x, title.right + KIT.sizeAfterTitle, 'size line x')
    expect(size.right).toBeLessThanOrEqual(b.right)
    await expect(page.getByTestId('book-size')).toHaveCSS('color', MUTED)

    await button.click()
    await parkPointer(page)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveCSS('background-color', FIELD)
    await expect(page.getByTestId('book-pages-input')).toBeVisible()

    // Kit toggle (chrome.tsx:170): a second click closes Book settings.
    await button.click()
    await parkPointer(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button).toHaveCSS('background-color', CLEAR)
    await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
    await expect(page.getByTestId('book-pages-input')).toHaveCount(0)

    // Picking a spread closes Book settings and releases the button.
    await button.click()
    await parkPointer(page)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await page
      .getByTestId(/^spread-list-item-/)
      .nth(1)
      .click()
    await parkPointer(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button).toHaveCSS('background-color', CLEAR)
  })

  for (const width of [1024, 1233]) {
    test(`stays on one line inside the 48 px bar at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await openLibraryBook(page, 'A long book title for a narrow window')
      await parkPointer(page)
      const bar = await box(page.getByTestId('editor-bar'))
      near(bar.height, 48, 'bar height')
      const b = await box(titleButton(page))
      near(b.height, KIT.titleHeight, 'title button height')
      expect(b.y).toBeGreaterThanOrEqual(bar.y)
      expect(b.y + b.height).toBeLessThanOrEqual(bar.y + bar.height)

      const title = await lineOf(page.getByTestId('book-title'))
      const size = await lineOf(page.getByTestId('book-size'))
      for (const [name, line] of [
        ['title', title],
        ['size', size],
      ] as const) {
        expect(line.whiteSpace, `${name} nowrap`).toBe('nowrap')
        expect(line.textOverflow, `${name} ellipsis`).toBe('ellipsis')
        expect(line.height, `${name} one line`).toBeLessThanOrEqual(
          line.lineHeight + TOL,
        )
      }
      // The size line gives way first: it is cut before the title is.
      expect(size.truncated).toBe(true)
      expect(
        title.truncated && size.visibleWidth > 1,
        'the title is cut only once the size line is gone',
      ).toBe(false)
      // History keeps its place right after the title block.
      const undo = await box(page.getByTestId('undo'))
      expect(undo.x).toBeGreaterThanOrEqual(b.right)
      await assertDocumentFitsViewport(page)
    })
  }
})

test.describe('design-r16-prod M84 contact sheet', () => {
  test('Contact sheet button sits at the right edge of its row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await page
      .getByTestId(/^spread-list-item-/)
      .nth(1)
      .click()
    await parkPointer(page)
    const apply = page.getByTestId('layout-contact-apply')
    await expect(apply).toHaveText('Contact sheet')
    const b = await box(apply)
    near(b.x, KIT.contactX, 'contact sheet x')
    near(b.right, KIT.contactRight, 'contact sheet right')
    near(b.width, KIT.contactWidth, 'contact sheet width')
    near(b.height, KIT.contactHeight, 'contact sheet height')
    const row = await box(page.getByRole('group', { name: 'Contact sheet' }))
    near(b.right, row.right, 'row right edge')
  })
})

test.describe('design-r16-prod M85 low-res chip', () => {
  test.beforeAll(() => {
    ensurePhotoFixtures()
  })

  test('a small photo carries the icon-only Low-res chip at default and max size; the header counts it', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    const items = page.getByTestId('filmstrip-item')
    await expect(page.getByTestId('lowres-chip')).toHaveCount(0)

    await choosePhotoFolder(page, [
      photoFixturePaths.samplePng,
      photoFixturePaths.largeJpeg,
    ])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
      timeout: 60_000,
    })
    await parkPointer(page)
    const chips = page.getByRole('img', { name: 'Low-res', exact: true })
    await expect(chips).toHaveCount(1)
    const small = items.filter({ has: chips })
    await expect(small).toHaveAttribute('aria-label', /sample-3x2/)

    const chip = chips.first()
    await expect(chip).toHaveAttribute('title', 'Low-res')
    await expect(chip).toHaveText('')
    const head = page.getByTestId('film-head')
    await expect(head).toHaveText('Photos · 2 · 0 used · 1 low-res')
    const count = head.getByTestId('lowres-count')
    await expect(count).toHaveText(' · 1 low-res')
    expect(await count.evaluate((el) => getComputedStyle(el).color)).toBe(
      WARNING_INK,
    )

    await expectIconOnlyChip(page, small, chip, 'default')
    const sep = page.getByRole('separator', { name: 'Resize photos' })
    await sep.focus()
    await page.keyboard.press('End')
    await expect(sep).toHaveAttribute(
      'aria-valuenow',
      (await sep.getAttribute('aria-valuemax')) ?? '',
    )
    await parkPointer(page)
    await expectIconOnlyChip(page, small, chip, 'max')

    const look = await chip.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        color: s.color,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        padding: s.padding,
        icon: el.querySelector('svg')?.getAttribute('data-icon'),
      }
    })
    expect(look).toEqual({
      color: WARNING_INK,
      bg: FIELD,
      radius: '4px',
      padding: '1px 4px',
      icon: 'warning',
    })
  })

  test('without low-res photos the Photos header says nothing about low-res', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await choosePhotoFolder(page, [photoFixturePaths.largeJpeg])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 60_000,
    })
    await expect(page.getByTestId('film-head')).toHaveText(
      'Photos · 1 · 0 used',
    )
    await expect(page.getByTestId('lowres-count')).toHaveCount(0)
    await expect(page.getByTestId('lowres-chip')).toHaveCount(0)
  })

  test('a portrait thumb carries the same icon-only Low-res chip, inside the thumb', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await choosePhotoFolder(page, [photoFixturePaths.sampleOrient6])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 60_000,
    })
    await parkPointer(page)

    const chip = page.getByTestId('lowres-chip')
    await expect(chip).toHaveCount(1)
    await expect(chip).toHaveAttribute('aria-label', 'Low-res')
    await expect(chip).toHaveAttribute('title', 'Low-res')
    const thumb = await box(page.locator('.filmstrip-drag'))
    expect(thumb.width).toBeLessThan(KIT.oldNarrowThumbMax)
    const c = await box(chip)
    near(c.x, thumb.x + KIT.chipInset, 'chip x')
    near(c.y, thumb.y + KIT.chipInset, 'chip y')
    near(c.width, KIT.chipWidth, 'chip width')
    near(c.height, KIT.chipHeight, 'chip height')
    expect(c.right).toBeLessThanOrEqual(thumb.right)
    const icon = await box(chip.locator('svg'))
    near(icon.width, KIT.chipIcon, 'icon width')
    near(icon.height, KIT.chipIcon, 'icon height')
    near(icon.x, c.x + 4, 'icon x')
    near(icon.y + icon.height / 2, c.y + c.height / 2, 'icon centre y')

    const look = await chip.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        color: s.color,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        padding: s.padding,
        whiteSpace: s.whiteSpace,
      }
    })
    expect(look).toEqual({
      color: WARNING_INK,
      bg: FIELD,
      radius: '4px',
      padding: '1px 4px',
      whiteSpace: 'nowrap',
    })
  })
})
