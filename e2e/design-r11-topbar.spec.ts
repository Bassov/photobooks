import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Owner Must M69, round 11, Designer review r10 2026-11-01 (step
// editor-spread-1). Kit values measured on the rendered kit `uikit#/demo` at
// 1440 × 900 with getBoundingClientRect / getComputedStyle, "Lake trip":
//
// Bar 48 tall at y 0. Library x 12, w 78; title button x 102; Undo x 400 and
//     Redo x 432 (32 × 32 at y 8: the title button's right + 16, flush).
// Zoom: out x 894 (28 × 28), menu x 924, 49 × 32 at "Fit", padding 0 8, bg
//     transparent, rgb(83, 81, 82); hover bg rgb(207, 207, 207),
//     rgb(57, 55, 56). In x 975 (menu right + 2).
// Panel toggles x 1015 / 1049 / 1083 (zoom-in right + 12, 34 apart), 32 × 32,
//     radius 8, padding 0, no shadow, colour rgb(83, 81, 82) on and off. On:
//     bg rgb(215, 215, 215), kept on hover. Off: transparent, hover
//     rgba(57, 55, 56, 0.08).
// Preview x 1123 (toggle-r right + 8), 96 × 32, full pill (computed
//     3.35544e+07px), padding 0 12, bg rgb(215, 215, 215), rgb(57, 55, 56),
//     no shadow, the same on hover.
// Settings x 1225 (Preview right + 6), 40 × 32, the same pill and colours.
// The kit's Print and Publish follow (out of scope: no Print / Publish in the
// product), so the product's right cluster ends at the bar's right inset,
// 1428, where the kit's last item ends.

const INK = 'rgb(57, 55, 56)'
const MUTED = 'rgb(83, 81, 82)'
const FIELD = 'rgb(215, 215, 215)'
const HOVER = 'rgb(207, 207, 207)'
const GHOST_HOVER = 'rgba(57, 55, 56, 0.08)'
const CLEAR = 'rgba(0, 0, 0, 0)'
const PILL = '3.35544e+07px'
const TOL = 0.5

const KIT = {
  barHeight: 48,
  libraryX: 12,
  libraryWidth: 78,
  titleX: 102,
  undoAfterTitle: 16,
  history: 32,
  zoomStep: 28,
  zoomMenuWidth: 49,
  zoomGap: 2,
  zoomToToggles: 12,
  toggle: 32,
  togglePitch: 34,
  togglesToPreview: 8,
  previewWidth: 96,
  previewToSettings: 6,
  settingsWidth: 40,
  height: 32,
  barEnd: 1428,
  // Product tool group (kit centres a wider group: 6 view toggles); it stays
  // where it is now (round 4, M39).
  toolSelectX: 573,
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

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      bg: s.backgroundColor,
      color: s.color,
      radius: s.borderRadius,
      padding: s.padding,
      shadow: s.boxShadow,
    }
  })
}

async function expectLook(
  page: Page,
  testId: string,
  want: { bg: string; color: string },
): Promise<void> {
  const el = page.getByTestId(testId)
  await expect
    .poll(async () => {
      const s = await look(el)
      return { bg: s.bg, color: s.color }
    })
    .toEqual(want)
}

async function parkPointer(page: Page): Promise<void> {
  await page.mouse.move(1439, 899)
}

async function openSpreadOne(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryBook(page)
  await page
    .getByTestId(/^spread-list-item-/)
    .nth(1)
    .click()
  await parkPointer(page)
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')
}

test.describe('design-r11-topbar M69', () => {
  test('controls match the kit: sizes, x, padding, radius, colours, shadow', async ({
    page,
  }) => {
    await openSpreadOne(page)
    const bar = await box(page.getByTestId('editor-bar'))
    near(bar.y, 0, 'bar y')
    near(bar.height, KIT.barHeight, 'bar height')

    const library = await box(page.getByTestId('go-library'))
    near(library.x, KIT.libraryX, 'library x')
    near(library.width, KIT.libraryWidth, 'library width')
    const title = await box(page.getByTestId('book-title').locator('..'))
    near(title.x, KIT.titleX, 'title x')
    near(
      (await box(page.getByTestId('tool-select'))).x,
      KIT.toolSelectX,
      'tool group x',
    )

    const undo = await box(page.getByTestId('undo'))
    const redo = await box(page.getByTestId('redo'))
    near(undo.x, title.right + KIT.undoAfterTitle, 'undo x')
    near(redo.x, undo.right, 'redo x')
    for (const [name, b] of [
      ['undo', undo],
      ['redo', redo],
    ] as const) {
      near(b.width, KIT.history, `${name} width`)
      near(b.height, KIT.history, `${name} height`)
      near(b.y, 8, `${name} y`)
    }

    const zoomOut = await box(page.getByTestId('zoom-out'))
    const menu = await box(page.getByTestId('zoom-menu'))
    const zoomIn = await box(page.getByTestId('zoom-in'))
    near(zoomOut.width, KIT.zoomStep, 'zoom-out width')
    near(menu.x, zoomOut.right + KIT.zoomGap, 'zoom menu x')
    near(menu.width, KIT.zoomMenuWidth, 'zoom menu width')
    near(menu.height, KIT.height, 'zoom menu height')
    near(zoomIn.x, menu.right + KIT.zoomGap, 'zoom-in x')
    expect(await look(page.getByTestId('zoom-menu'))).toEqual({
      bg: CLEAR,
      color: MUTED,
      radius: '8px',
      padding: '0px 8px',
      shadow: 'none',
    })

    let left = zoomIn.right + KIT.zoomToToggles
    for (const k of ['l', 'b', 'r']) {
      const t = await box(page.getByTestId(`toggle-${k}`))
      near(t.x, left, `toggle-${k} x`)
      near(t.width, KIT.toggle, `toggle-${k} width`)
      near(t.height, KIT.toggle, `toggle-${k} height`)
      expect(await look(page.getByTestId(`toggle-${k}`))).toEqual({
        bg: FIELD,
        color: MUTED,
        radius: '8px',
        padding: '0px',
        shadow: 'none',
      })
      left += KIT.togglePitch
    }
    const toggleR = await box(page.getByTestId('toggle-r'))

    const preview = await box(page.getByTestId('present'))
    const settings = await box(page.getByTestId('editor-settings-open'))
    near(preview.x, toggleR.right + KIT.togglesToPreview, 'preview x')
    near(preview.width, KIT.previewWidth, 'preview width')
    near(preview.height, KIT.height, 'preview height')
    near(settings.x, preview.right + KIT.previewToSettings, 'settings x')
    near(settings.width, KIT.settingsWidth, 'settings width')
    near(settings.height, KIT.height, 'settings height')
    near(settings.right, KIT.barEnd, 'right cluster end')
    for (const id of ['present', 'editor-settings-open']) {
      expect(await look(page.getByTestId(id))).toEqual({
        bg: FIELD,
        color: INK,
        radius: PILL,
        padding: '0px 12px',
        shadow: 'none',
      })
    }
  })

  test('hover and the toggle off state match the kit', async ({ page }) => {
    await openSpreadOne(page)

    await page.getByTestId('toggle-l').hover()
    await expectLook(page, 'toggle-l', { bg: FIELD, color: MUTED })
    await page.getByTestId('present').hover()
    await expectLook(page, 'present', { bg: FIELD, color: INK })
    await page.getByTestId('editor-settings-open').hover()
    await expectLook(page, 'editor-settings-open', { bg: FIELD, color: INK })
    await page.getByTestId('zoom-menu').hover()
    await expectLook(page, 'zoom-menu', { bg: HOVER, color: INK })
    await page.getByTestId('zoom-out').hover()
    await expectLook(page, 'zoom-out', { bg: HOVER, color: INK })

    await page.getByTestId('toggle-b').click()
    await expect(page.getByTestId('toggle-b')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expectLook(page, 'toggle-b', { bg: GHOST_HOVER, color: MUTED })
    await parkPointer(page)
    await expectLook(page, 'toggle-b', { bg: CLEAR, color: MUTED })
    await expectLook(page, 'toggle-l', { bg: FIELD, color: MUTED })
    expect(await look(page.getByTestId('toggle-b'))).toMatchObject({
      radius: '8px',
      padding: '0px',
      shadow: 'none',
    })
    // Hiding a panel moves nothing in the bar.
    const toggles = await box(page.getByTestId('toggle-b'))
    const zoomIn = await box(page.getByTestId('zoom-in'))
    near(toggles.x, zoomIn.right + KIT.zoomToToggles + KIT.togglePitch, 'x')
    near(
      (await box(page.getByTestId('editor-settings-open'))).right,
      KIT.barEnd,
      'right cluster end',
    )
    near(
      (await box(page.getByTestId('editor-bar'))).height,
      KIT.barHeight,
      'bar height',
    )
  })
})
