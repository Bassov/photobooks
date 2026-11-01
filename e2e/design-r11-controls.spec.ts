import type { Locator, Page } from '@playwright/test'
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

// Owner rule: every Designer item is a Must; round 11, Designer review r10
// 2026-11-01 (M68, M70, M71). Kit values measured on the rendered kit
// `uikit#/demo` at 1440 × 900 with getBoundingClientRect / getComputedStyle,
// replaying the demo-capture steps in the Playwright Chromium the e2e suite
// uses (default font hinting):
//
// M68 inputs: no input / textarea / select computes Arial or 13.3333px on
//     welcome, library, Create book, Book settings, Cover, Photo (+ crop) and
//     Settings. editor-cover-photo-and-title: Front / Spine / Back title
//     fields Inter 13px / 400 rgb(57, 55, 56). editor-frame-selected:
//     Caption Inter 13px / 400. editor-inspector-book: W / H inputs
//     ui-monospace 13px / 400 rgb(57, 55, 56), x 1186 / 1324, y 283.06,
//     64 × 18.84; Pages Inter 13px; PRINT B / S values ui-monospace 13px,
//     x 1186 / 1324, y 588.13, 60 × 18.84.
// M70 buttons (kit `outline`, no border: `0px solid rgba(0, 0, 0, 0)`):
//     Crop, 90° left / right: 130 × 32 at x 1156 / 1294, bg rgb(215, 215,
//     215), box-shadow 0 1px 2px rgba(20, 20, 19, .06) (kit `shadow-xs`;
//     its leading transparent ring layers are dropped here), radius 8px,
//     padding 0 12. Flip H / V: the same box without a shadow (kit
//     inspector.tsx:157 has no `shadow-xs`). Welcome "Create Library" 160 ×
//     48 at x 56, padding 0 28; library "Create book" pill 144 × 48 at
//     x 749.19; Create book dialog Cancel x 734, 76 × 36 and Create book
//     x 818, 108 × 36, both padding 0 16.
// M71 Settings (settings-from-library): "Library" crumb rgb(57, 55, 56),
//     78 × 32 at x 12; selected nav row bg rgb(207, 207, 207), x 12, 195 ×
//     34.84; "Change library folder…" 187 × 32 at x 689, y 181.44, kit
//     outline + shadow-xs, padding 0 12. Library bar (library-empty):
//     "Change library folder…" 24 px tall full pill (kit `rounded-full`),
//     padding 0 10, 8 px after the path, rgb(83, 81, 82) 13px / 500.

const INK = 'rgb(57, 55, 56)'
const MUTED = 'rgb(83, 81, 82)'
const FIELD = 'rgb(215, 215, 215)'
const NO_BORDER = '0px solid rgba(0, 0, 0, 0)'
const SHADOW_XS = 'rgba(20, 20, 19, 0.06) 0px 1px 2px 0px'
const TOL = 0.5

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('no box')
  return b
}

async function expectBox(
  locator: Locator,
  kit: Partial<Record<'x' | 'y' | 'width' | 'height', number>>,
): Promise<void> {
  const b = await box(locator)
  for (const [k, v] of Object.entries(kit)) {
    const got = b[k as keyof typeof b]
    expect(
      Math.abs(got - v),
      `${k} ${String(got)} vs kit ${String(v)}`,
    ).toBeLessThan(TOL)
  }
}

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      family: s.fontFamily.split(',')[0]?.replaceAll('"', '').trim(),
      size: s.fontSize,
      weight: s.fontWeight,
      color: s.color,
      bg: s.backgroundColor,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      shadow: s.boxShadow,
      radius: s.borderTopLeftRadius,
      padding: s.padding,
    }
  })
}

async function type(locator: Locator) {
  const { family, size, weight, color } = await look(locator)
  return { family, size, weight, color }
}

/** Every form control on the page: none keeps the UA Arial 13.33 px. */
async function expectNoUaInputFont(page: Page, min = 1): Promise<void> {
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea, select')].map((el) => {
      const s = getComputedStyle(el)
      return {
        id: `${el.tagName}|${el.getAttribute('type') ?? ''}|${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? ''}`,
        family: s.fontFamily,
        size: s.fontSize,
      }
    }),
  )
  expect(controls.length).toBeGreaterThanOrEqual(min)
  const ua = controls.filter(
    (c) => /\bArial\b/.test(c.family) || c.size === '13.3333px',
  )
  expect(ua).toEqual([])
}

async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

async function openWelcome(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await fontsReady(page)
}

async function openLibraryWithBook(page: Page): Promise<void> {
  await openWelcome(page)
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) throw new Error(attached.code ?? 'attach')
    const created = await api.createBookInLibrary('Lake trip')
    if (!created.ok) throw new Error(created.code ?? 'create')
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await fontsReady(page)
}

async function expectKitOutline(
  button: Locator,
  shadow: string,
  kit: { x: number; width?: number; height?: number },
): Promise<void> {
  expect(await look(button)).toEqual({
    family: 'Inter Variable',
    size: '13px',
    weight: '500',
    color: INK,
    bg: FIELD,
    border: NO_BORDER,
    shadow,
    radius: '8px',
    padding: '0px 12px',
  })
  await expectBox(button, { width: 130, height: 32, ...kit })
}

test.describe('design-r11-controls: inputs, buttons and Settings match the kit', () => {
  test('M68 / M70: welcome, empty library and Create book controls', async ({
    page,
  }) => {
    await openWelcome(page)
    await expectNoUaInputFont(page, 0)
    const createLibrary = page.getByTestId('create-library')
    const pill = await look(createLibrary)
    expect(pill.border).toBe(NO_BORDER)
    expect(pill.padding).toBe('0px 28px')
    await expectBox(createLibrary, { x: 56, width: 160, height: 48 })

    await page.evaluate(async () => {
      const api = window.__photobooksProject
      if (!api?.seedHomeRecentsForTests) throw new Error('missing api')
      await api.seedHomeRecentsForTests(0)
    })
    await expect(page.getByTestId('library-empty')).toBeVisible({
      timeout: 15_000,
    })
    await fontsReady(page)
    await expectNoUaInputFont(page, 0)
    const createBook = page.getByTestId('new-book').first()
    expect((await look(createBook)).border).toBe(NO_BORDER)
    await expectBox(createBook, { x: 749.19, width: 144, height: 48 })

    // M71: library bar "Change library folder…" is the kit 24 px pill.
    const change = page.getByTestId('change-library')
    const changeLook = await look(change)
    expect(changeLook).toMatchObject({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: MUTED,
      border: NO_BORDER,
      shadow: 'none',
      padding: '0px 10px',
    })
    expect(Number.parseFloat(changeLook.radius)).toBeGreaterThanOrEqual(12)
    const path = await box(page.getByTestId('library-path'))
    await expectBox(change, { x: path.x + path.width + 8, y: 16, height: 24 })

    await page.getByTestId('new-book').first().click()
    const dialog = page.getByTestId('create-book-dialog')
    await expect(dialog).toBeVisible()
    await page.getByTestId('create-title').fill('Lake trip')
    await page.mouse.move(1439, 899)
    await expectNoUaInputFont(page)
    expect(await type(page.getByTestId('create-title'))).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '400',
      color: INK,
    })
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    expect(await look(cancel)).toMatchObject({
      border: NO_BORDER,
      padding: '0px 16px',
    })
    await expectBox(cancel, { x: 734, width: 76, height: 36 })
    const create = dialog.getByTestId('create-book')
    expect(await look(create)).toMatchObject({
      border: NO_BORDER,
      padding: '0px 16px',
    })
    await expectBox(create, { x: 818, width: 108, height: 36 })

    await dialog.getByTestId('create-preset').click()
    await page.getByRole('option', { name: /Custom size/ }).click()
    await page.getByTestId('create-custom-w').fill('19')
    await expectNoUaInputFont(page)
  })

  test('M71: Settings crumb, nav row and folder button match the kit', async ({
    page,
  }) => {
    await openLibraryWithBook(page)
    await expectNoUaInputFont(page)
    const card = page.getByTestId('book-card').first()
    await card.hover()
    await card.getByRole('button', { name: 'Book actions' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await expect(page.getByTestId('rename-input')).toBeVisible()
    await expectNoUaInputFont(page)
    await page.getByTestId('rename-input').press('Escape')

    await page.getByTestId('library-settings').click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await fontsReady(page)
    await page.mouse.move(1439, 899)
    await expectNoUaInputFont(page, 0)

    const back = page.getByTestId('settings-back')
    expect(await type(back)).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: INK,
    })
    await expectBox(back, { x: 12, width: 78, height: 32 })

    const row = page.getByTestId('settings-nav-library')
    expect((await look(row)).bg).toBe('rgb(207, 207, 207)')
    await expectBox(row, { x: 12, y: 102, width: 195, height: 34.84 })

    const change = page
      .getByTestId('library-settings-panel')
      .getByTestId('change-library')
    expect(await look(change)).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: INK,
      bg: FIELD,
      border: NO_BORDER,
      shadow: SHADOW_XS,
      radius: '8px',
      padding: '0px 12px',
    })
    await expectBox(change, { x: 689, y: 181.44, width: 187, height: 32 })
  })
})

test.describe('design-r11-controls: editor inspectors match the kit', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await fontsReady(page)
  })

  test('M68: Book settings fields: W / H and PRINT values in mono', async ({
    page,
  }) => {
    await expectNoUaInputFont(page)
    await page.getByTestId('book-title').click()
    await expect(page.getByTestId('size-w')).toBeVisible()
    await page.mouse.move(0, 899)
    await expectNoUaInputFont(page)

    const mono = {
      family: 'ui-monospace',
      size: '13px',
      weight: '400',
      color: INK,
    }
    for (const [id, x] of [
      ['size-w', 1186],
      ['size-h', 1324],
    ] as const) {
      const input = page.getByTestId(id)
      expect(await type(input)).toEqual(mono)
      await expectBox(input, { x, y: 283.06, width: 64, height: 18.84 })
    }
    expect(await type(page.getByTestId('book-pages-input'))).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '400',
      color: INK,
    })
    for (const [id, x] of [
      ['book-bleed', 1186],
      ['book-safe-margin', 1324],
    ] as const) {
      const value = page.getByTestId(id).locator('span').nth(1)
      expect(await type(value)).toEqual(mono)
      await expectBox(value, { x, y: 588.13, width: 60, height: 18.84 })
    }
  })

  test('M68: Cover title fields are Inter 13', async ({ page }) => {
    await page.getByTestId('cover-list-item').click()
    await expect(page.getByTestId('insp-cover')).toBeVisible()
    await expectNoUaInputFont(page)
    for (const id of [
      'cover-text-front',
      'cover-text-spine',
      'cover-text-back',
    ]) {
      expect(await type(page.getByTestId(id))).toEqual({
        family: 'Inter Variable',
        size: '13px',
        weight: '400',
        color: INK,
      })
    }
  })

  test('M68 / M70: Photo inspector inputs, turn, flip and crop buttons', async ({
    page,
  }) => {
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0)
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
    await page.mouse.move(0, 899)
    await expectNoUaInputFont(page)
    expect(await type(page.getByTestId('caption-input'))).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '400',
      color: INK,
    })

    await expectKitOutline(page.getByTestId('crop-toggle'), SHADOW_XS, {
      x: 1156,
    })
    await expectKitOutline(page.getByTestId('rot-left'), SHADOW_XS, {
      x: 1156,
    })
    await expectKitOutline(page.getByTestId('rot-right'), SHADOW_XS, {
      x: 1294,
    })
    await expectKitOutline(page.getByTestId('flip-h'), 'none', { x: 1156 })
    await expectKitOutline(page.getByTestId('flip-v'), 'none', { x: 1294 })

    await page.getByTestId('crop-toggle').click()
    await expect(page.getByTestId('crop-toggle')).toHaveText('Done')
    await expectNoUaInputFont(page)
  })
})
