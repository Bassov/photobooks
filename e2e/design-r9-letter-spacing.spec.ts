import type { Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
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

// Owner Must M57, round 9, relayed by Designer 2026-11-01 (prod 413bb41).
// Kit values measured on the rendered kit `uikit#/demo` (v0.10.0) at
// 1440 × 900, 19 × 23 cm "Lake trip", with getComputedStyle on every visible
// element whose computed text-transform is `uppercase`:
//
// Kit `Sec` title (v7.tsx:131, h3): 11px, 600, uppercase, rgb(83, 81, 82),
//     letter-spacing 1.32px (0.12em). Steps: editor-cover-selected (insp-cover
//     FRONT, SPINE, BACK, MATERIAL), editor-inspector-book (insp-book PAGE
//     SIZE, BINDING, PRINT, DEFAULTS), editor-endpaper-selected and the back
//     endpaper (insp-endpaper FILL, APPLY; FILL 27.23 px, APPLY 42.11 px wide).
// Kit Section eyebrow (ui.tsx:51 `.eyebrow`, span): 11px, 600, uppercase,
//     rgb(83, 81, 82), letter-spacing 0.66px (0.06em). Steps: editor-pages-mode
//     spread context (LAYOUT, MASTER & SPACING, BACKGROUND, GRID),
//     editor-frame-selected photo context (FIT & CROP, ROTATE & FLIP, ADJUST,
//     CAPTION, POSITION & SIZE, FRAME STYLE, ARRANGE).
// No other uppercase element renders in the kit editor: the spread list,
//     filmstrip, top bar and menus have no uppercase section titles.
// r8 M48 (editor-endpaper-selected) row tops: FILL 121.64, Style 148.48,
//     Pattern 187.33, APPLY 243.33, "Same on back endpaper" 270.17.

const TITLE = {
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  color: 'rgb(83, 81, 82)',
}
const SEC_TRACKING = 1.32
const EYEBROW_TRACKING = 0.66

const KIT = {
  spread: ['Layout', 'Master & spacing', 'Background', 'Grid'],
  photo: [
    'Photo',
    'Fit & crop',
    'Rotate & flip',
    'Adjust',
    'Caption',
    'Position & size',
    'Frame style',
    'Arrange',
  ],
  cover: ['Front', 'Spine', 'Back', 'Material'],
  book: ['Page size', 'Binding', 'Print', 'Defaults'],
  endpaper: ['Fill', 'Apply'],
  m48: {
    fillTitle: 121.64,
    styleRow: 148.48,
    patternRow: 187.33,
    applyTitle: 243.33,
    sameRow: 270.17,
  },
} as const

interface UppercaseRead {
  text: string
  letterSpacing: number
  fontSize: string
  fontWeight: string
  textTransform: string
  color: string
}

/** Every visible outermost uppercase element on the page, in DOM order. */
async function readUppercase(page: Page): Promise<UppercaseRead[]> {
  return page.evaluate(() => {
    const out: UppercaseRead[] = []
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el)
      if (s.textTransform !== 'uppercase') continue
      const parent = el.parentElement
      if (parent && getComputedStyle(parent).textTransform === 'uppercase') {
        continue
      }
      const r = el.getBoundingClientRect()
      const text = el.textContent.trim()
      if (!r.width || !r.height || s.visibility === 'hidden' || !text) continue
      out.push({
        text,
        letterSpacing: Number.parseFloat(s.letterSpacing),
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        textTransform: s.textTransform,
        color: s.color,
      })
    }
    return out
  })
}

/** The page's uppercase titles are exactly `titles`, each at the kit type. */
async function expectKitTitles(
  page: Page,
  titles: readonly string[],
  tracking: number,
): Promise<void> {
  await expect
    .poll(async () => (await readUppercase(page)).map((t) => t.text))
    .toEqual([...titles])
  for (const read of await readUppercase(page)) {
    const { text, letterSpacing, ...type } = read
    expect(type, text).toEqual(TITLE)
    expect(Math.abs(letterSpacing - tracking), text).toBeLessThanOrEqual(0.01)
  }
}

async function topOf(page: Page, selector: string, index: number) {
  const box = await page.locator(selector).nth(index).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  return box.y
}

function near(actual: number, kit: number): void {
  expect(Math.abs(actual - kit)).toBeLessThanOrEqual(0.5)
}

test.describe('M57: uppercase section titles match the kit type', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
  })

  test('cover Sec titles: 0.12em like the kit', async ({ page }) => {
    await page.getByTestId('cover-list-item').click()
    await expect(page.getByTestId('insp-cover')).toBeVisible()
    await expectKitTitles(page, KIT.cover, SEC_TRACKING)
  })

  test('book settings Sec titles: 0.12em like the kit', async ({ page }) => {
    await page.getByTestId('book-title').click()
    await expect(page.getByTestId('book-settings')).toBeVisible()
    await expectKitTitles(page, KIT.book, SEC_TRACKING)
  })

  test('endpaper front and back Sec titles: 0.12em; M48 row tops stay', async ({
    page,
  }) => {
    await page.getByTestId('endpaper-list-item-front').click()
    await expect(page.getByTestId('insp-endpaper')).toBeVisible()
    await expectKitTitles(page, KIT.endpaper, SEC_TRACKING)

    const scope = '[data-testid="insp-endpaper"]'
    const titles = `${scope} .endpaper-sec-title`
    const rows = `${scope} .endpaper-row`
    near(await topOf(page, titles, 0), KIT.m48.fillTitle)
    near(await topOf(page, rows, 0), KIT.m48.styleRow)
    near(await topOf(page, rows, 1), KIT.m48.patternRow)
    near(await topOf(page, titles, 1), KIT.m48.applyTitle)
    near(await topOf(page, rows, 2), KIT.m48.sameRow)

    await page.getByTestId('endpaper-list-item-back').click()
    await expect(page.getByTestId('insp-endpaper')).toBeVisible()
    await expectKitTitles(page, KIT.endpaper, SEC_TRACKING)
  })

  test('spread Disclosure titles keep the kit eyebrow 0.06em', async ({
    page,
  }) => {
    await page.locator('[data-testid^="spread-list-item-"]').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
    await expectKitTitles(page, KIT.spread, EYEBROW_TRACKING)
  })

  test('photo frame titles keep the kit eyebrow 0.06em', async ({ page }) => {
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0)
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
    await expectKitTitles(page, KIT.photo, EYEBROW_TRACKING)
  })

  test('panels and menus add no uppercase section titles', async ({ page }) => {
    await page.locator('[data-testid^="spread-list-item-"]').first().click()
    await page.getByTestId('zoom-menu').click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectKitTitles(page, KIT.spread, EYEBROW_TRACKING)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)

    const row = page.locator('[data-testid^="spread-list-item-"]').nth(1)
    await row.hover()
    await page.getByRole('button', { name: 'Pages 2–3 actions' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectKitTitles(page, KIT.spread, EYEBROW_TRACKING)
  })
})
