import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Owner Musts M58, M62, M63, round 10, Designer review r9 2026-11-01.
// Kit values measured on the rendered kit `uikit#/demo` at 1440 × 900 with
// getBoundingClientRect / getComputedStyle; "Lake trip" title:
//
// M58 buttons: no `<button>` on any walked step computes Arial or 13.3333px
//     (the UA default). Pages / Masters: 92 × 26 at y 62, Inter 13px / 500,
//     selected rgb(57, 55, 56), other rgb(83, 81, 82). Spread list labels
//     (Cover, Endpaper, 1, 2–3): Inter 11px. "Add folder…": Inter 12px / 500,
//     rgb(57, 55, 56). Settings nav "Library": Inter 13px / 500,
//     rgb(57, 55, 56).
// M62 layout picker (editor-new-blank-book, editor-spread-1): "All" tab
//     rgb(57, 55, 56), "My templates" rgb(83, 81, 82). Tile captions
//     (context-inspector.tsx:106) are `text-muted-foreground
//     group-hover:text-foreground` with the Section Disclosure as `group`:
//     unselected captions rgb(83, 81, 82) / 400 at rest and rgb(57, 55, 56)
//     while the pointer is over the Layout section.
// M63 Create book (default A5): title label box top 343.35 (text top 341.35),
//     Orientation 478.15, hint 544.95, Cancel Inter 13px / 500
//     rgb(57, 55, 56). Size menu rows 30.84 px tall and apart, A5 505.84,
//     A4 536.69. Custom size: select value top 426.33.

const INK = 'rgb(57, 55, 56)'
const MUTED = 'rgb(83, 81, 82)'
const TOL = 0.5

const KIT = {
  titleLabel: 343.35,
  titleText: 341.35,
  orientation: 478.15,
  hint: 544.95,
  menuPitch: 30.84,
  menuA5: 505.84,
  menuA4: 536.69,
  customValue: 426.33,
}

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('no box')
  return box.y
}

async function textTop(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getBoundingClientRect().y
  })
}

async function font(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      family: s.fontFamily.split(',')[0]?.replaceAll('"', '').trim(),
      size: s.fontSize,
      weight: s.fontWeight,
      color: s.color,
    }
  })
}

/** Row height and top-to-top pitch deviations from the kit 30.84 px. */
async function rowMetrics(rows: Locator) {
  const boxes = await rows.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()),
  )
  const tops = boxes.map((b) => b.y)
  return {
    count: boxes.length,
    heights: boxes.map((b) => Math.abs(b.height - KIT.menuPitch)),
    pitches: tops
      .slice(1)
      .map((y, i) => Math.abs(y - (tops[i] ?? Number.NaN) - KIT.menuPitch)),
  }
}

/** Visible buttons that still compute the UA button font. */
async function arialButtons(page: Page): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready)
  return page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return (
          r.width > 0 &&
          r.height > 0 &&
          (/arial/i.test(s.fontFamily) || s.fontSize === '13.3333px')
        )
      })
      .map(
        (el) =>
          `${el.getAttribute('data-testid') ?? ''}|${el.textContent.trim().slice(0, 30)}`,
      ),
  )
}

async function openLibrary(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) throw new Error(attached.code ?? 'attach')
    const created = await api.createBookInLibrary()
    if (!created.ok) throw new Error(created.code ?? 'create')
    await api.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByTestId('new-book').first().click()
  const dialog = page.getByTestId('create-book-dialog')
  await expect(dialog).toBeVisible()
  await page.getByTestId('create-title').fill('Lake trip')
  await page.mouse.move(1439, 899)
  return dialog
}

async function createBook(page: Page): Promise<void> {
  const dialog = await openCreateDialog(page)
  await dialog.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
}

test.describe('design-r10-chrome (M58 / M62 / M63)', () => {
  test('M63: Create book rows, size menu pitch, Custom row and Cancel ink', async ({
    page,
  }) => {
    await openLibrary(page)
    const dialog = await openCreateDialog(page)
    const title = dialog.getByText('Title', { exact: true })
    expect(Math.abs((await top(title)) - KIT.titleLabel)).toBeLessThan(TOL)
    expect(Math.abs((await textTop(title)) - KIT.titleText)).toBeLessThan(TOL)
    const orientation = dialog
      .getByTestId('create-orientation')
      .getByText('Orientation', { exact: true })
    expect(Math.abs((await top(orientation)) - KIT.orientation)).toBeLessThan(
      TOL,
    )
    const hint = dialog.getByText(/^Size of one page\./)
    expect(Math.abs((await top(hint)) - KIT.hint)).toBeLessThan(TOL)
    expect(await font(dialog.getByRole('button', { name: 'Cancel' }))).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: INK,
    })

    await dialog.getByTestId('create-preset').click()
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()
    const rows = await rowMetrics(options)
    expect(rows.count).toBeGreaterThan(4)
    expect(Math.max(...rows.heights, ...rows.pitches)).toBeLessThan(TOL)
    const a5 = page.getByRole('option', { name: /^A5/ })
    const a4 = page.getByRole('option', { name: /^A4/ })
    expect(Math.abs((await top(a5)) - KIT.menuA5)).toBeLessThan(TOL)
    expect(Math.abs((await top(a4)) - KIT.menuA4)).toBeLessThan(TOL)
    expect(await arialButtons(page)).toEqual([])

    await page.getByRole('option', { name: /Custom size/ }).click()
    await page.getByTestId('create-custom-w').fill('19')
    await page.getByTestId('create-custom-h').fill('23')
    await page.mouse.move(1439, 899)
    const value = dialog
      .getByTestId('create-preset')
      .getByText('Custom size…', { exact: true })
    expect(Math.abs((await top(value)) - KIT.customValue)).toBeLessThan(TOL)
    expect(await arialButtons(page)).toEqual([])
  })

  test('M58: Pages / Masters, spread list, Add folder in Inter', async ({
    page,
  }) => {
    await openLibrary(page)
    await createBook(page)
    await page.mouse.move(1439, 899)
    const pages = page.getByTestId('left-tab-pages')
    const masters = page.getByTestId('left-tab-masters')
    expect(await pages.boundingBox()).toEqual({
      x: 14,
      y: 62,
      width: 92,
      height: 26,
    })
    expect(await masters.boundingBox()).toEqual({
      x: 106,
      y: 62,
      width: 92,
      height: 26,
    })
    expect(await font(pages)).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: INK,
    })
    expect(await font(masters)).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: MUTED,
    })
    for (const id of [
      'cover-list-item',
      'endpaper-list-item-front',
      'spread-list-item-spread-1',
      'spread-list-item-spread-2',
    ]) {
      const item = await font(page.getByTestId(id))
      expect(item.family, id).toBe('Inter Variable')
      expect(item.size, id).toBe('13px')
    }
    expect(await font(page.getByTestId('film-add-folder'))).toEqual({
      family: 'Inter Variable',
      size: '12px',
      weight: '500',
      color: INK,
    })
  })

  test('M62: layout tabs and captions take the kit colours', async ({
    page,
  }) => {
    await openLibrary(page)
    await createBook(page)
    const captions = page.locator(
      ".layout-tile:not([aria-pressed='true']) .layout-tile-name",
    )
    const check = async (step: string) => {
      expect(
        (await font(page.getByTestId('tab-all'))).color,
        `${step} All`,
      ).toBe(INK)
      expect(
        (await font(page.getByTestId('tab-mine'))).color,
        `${step} My templates`,
      ).toBe(MUTED)
      await expect(captions.first()).toBeVisible()
      await page.mouse.move(720, 20)
      for (const caption of await captions.all()) {
        expect(await font(caption), `${step} at rest`).toEqual({
          family: 'Inter Variable',
          size: '11px',
          weight: '400',
          color: MUTED,
        })
      }
      await page.getByTestId('tab-mine').hover()
      for (const caption of await captions.all()) {
        expect((await font(caption)).color, `${step} hover`).toBe(INK)
      }
    }
    await check('editor-new-blank-book')
    await page.getByTestId('spread-list-item-spread-1').click()
    await check('editor-spread-1')
  })

  test('M58: no Arial button on library, settings, create and editor steps', async ({
    page,
  }) => {
    await openLibrary(page)
    const found: string[] = []
    const audit = async (step: string) => {
      await page.mouse.move(1439, 899)
      const hits = await arialButtons(page)
      found.push(...hits.map((hit) => `${step}: ${hit}`))
    }
    await audit('library')
    await page.getByTestId('library-settings').click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await audit('settings-from-library')
    expect(await font(page.getByTestId('settings-nav-library'))).toEqual({
      family: 'Inter Variable',
      size: '13px',
      weight: '500',
      color: INK,
    })
    await page.getByTestId('settings-back').first().click()
    await expect(page.getByTestId('new-book')).toBeVisible()
    await openCreateDialog(page)
    await audit('create-book-dialog')
    await page.getByTestId('create-book').click()
    await expect(page.getByTestId('editor-shell')).toBeVisible({
      timeout: 15_000,
    })
    await audit('editor-new-blank-book')
    await page.getByTestId('cover-list-item').click()
    await audit('editor-cover-selected')
    await page.getByTestId('spread-list-item-spread-1').click()
    await audit('editor-spread-1')
    await page.getByTestId('left-tab-masters').click()
    await audit('editor-masters-mode')
    await page.getByTestId('left-tab-pages').click()
    await audit('editor-pages-mode')
    await page.getByTestId('editor-settings-open').click()
    await audit('settings-from-editor')
    expect(found).toEqual([])
  })
})
