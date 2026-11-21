import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Designer frame-context-menu FM3 (prod = kit FM1, e2e/kit-frame-menu.spec.ts):
// one fixed order of rows in groups photo · edit · order · lock + delete;
// rows that do not apply are disabled, not hidden. A pointer open highlights
// no row, Shift+F10 focuses the first enabled one. After a frame copy, a
// right-click on the paper opens the page menu (Paste / Paste in place).

test.use({ viewport: { width: 1440, height: 900 } })

const FILLED = [
  'Replace photo…',
  'Remove photo',
  'Fit photo to frame',
  'Crop',
  'Cut',
  'Copy',
  'Paste',
  'Duplicate',
  'Bring to front',
  'Bring forward',
  'Send backward',
  'Send to back',
  'Lock',
  'Delete frame',
]
const EDIT = ['Cut', 'Copy', 'Paste', 'Duplicate']
const ORDER = [
  'Bring to front',
  'Bring forward',
  'Send backward',
  'Send to back',
]

/** The kit's paste step (frame-copy-paste D3). */
const STEP_MM = 5

const menu = (page: Page) => page.getByTestId('frame-menu')
const row = (page: Page, id: string) => page.getByTestId(`frame-menu-${id}`)
const thumbs = (page: Page) => page.getByTestId('filmstrip-item')
const undoLabel = (page: Page) =>
  page.getByTestId('undo').getAttribute('aria-label')

/** Labels without the key column. */
function labels(m: Locator) {
  return m.getByRole('menuitem').evaluateAll((els) =>
    els.map((e) =>
      [...e.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim(),
    ),
  )
}

function disabled(m: Locator) {
  return m
    .getByRole('menuitem')
    .evaluateAll((els) =>
      els
        .filter((e) => e.getAttribute('aria-disabled') === 'true')
        .map((e) => e.getAttribute('data-testid')),
    )
}

/** The popover box once its entry animation has finished. */
async function popoverBox(page: Page) {
  const pop = page.locator('.pb-menu-popover')
  return pop.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations({ subtree: true }).map((a) => a.finished),
    )
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

interface PhotoSetup {
  filled: Locator
  empty: Locator
  frames: Locator
  assets: string[]
}

/** Three photos; a 2 × 1 sheet with the first photo in frame A, B empty. */
async function photoSetup(page: Page): Promise<PhotoSetup> {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
    photoFixturePaths.metaLake,
  ])
  await expect(thumbs(page)).toHaveCount(3, { timeout: 30_000 })
  await applyContactSheet(page, 2, 1)
  const view = page.getByTestId('spread-view').first()
  const frames = view.getByTestId('spread-frame')
  await expect(frames).toHaveCount(2)
  const ids = await frames.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-frame-id') ?? ''),
  )
  const assets = await thumbs(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-asset-id') ?? ''),
  )
  const filled = view.locator(`button[data-frame-id="${ids[0] ?? ''}"]`)
  const empty = view.locator(`button[data-frame-id="${ids[1] ?? ''}"]`)
  await dropAssetOnFrame(page, assets[0] ?? '', filled)
  await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
  return { filled, empty, frames, assets }
}

test.describe('Frame context menu on photo frames (FM3)', () => {
  test.beforeAll(() => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  })

  test('filled frame: 14 rows, 3 separators, 224 × 468.81; no row focused; hover #CFCFCF; Delete focus = destructive mix', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled } = await photoSetup(page)
    await filled.click({ button: 'right' })
    await expect(menu(page)).toBeVisible()
    expect(await labels(menu(page))).toEqual(FILLED)
    await expect(menu(page).getByRole('separator')).toHaveCount(3)
    // nothing copied yet; the frame is at the back of none (2 frames, no overlap)
    expect(await disabled(menu(page))).toContain('frame-menu-paste')
    const box = await popoverBox(page)
    expect(box.width).toBeCloseTo(224, 0)
    expect(Math.abs(box.height - 468.81)).toBeLessThanOrEqual(0.5)
    // M5: a pointer open focuses the menu, not a row
    await expect(menu(page)).toBeFocused()
    await expect(menu(page).locator('[data-focused]')).toHaveCount(0)

    // hover paints the row --accent #CFCFCF (pixels, not only style)
    const copy = row(page, 'copy')
    await copy.hover()
    await expect(copy).toHaveAttribute('data-focused', 'true')
    const h = (await copy.boundingBox())?.height ?? 0
    const [hover] = await pixelsAt(copy, [{ x: 3, y: h / 2 }])
    expect(hover?.slice(0, 3)).toEqual([207, 207, 207])

    // the Delete row's focus bg is the destructive mix
    await page.keyboard.press('End')
    const del = row(page, 'delete')
    await expect(del).toHaveAttribute('data-focused', 'true')
    const [want, got] = await del.evaluate((el) => {
      const probe = document.createElement('div')
      probe.style.background =
        'color-mix(in srgb, var(--destructive) 10%, var(--popover))'
      el.parentElement?.append(probe)
      const mix = getComputedStyle(probe).backgroundColor
      probe.remove()
      return [mix, getComputedStyle(el).backgroundColor]
    })
    expect(got).toBe(want)
    // 10 % #393738 over the rgb(225) popover = rgb(208.2, 208, 208.1)
    const [paint] = await pixelsAt(del, [{ x: 3, y: h / 2 }])
    for (const channel of paint?.slice(0, 3) ?? []) {
      expect(Math.abs(channel - 208)).toBeLessThanOrEqual(1)
    }
  })

  test('opened at y 840 the menu flips inside the viewport', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled } = await photoSetup(page)
    const b = await filled.boundingBox()
    await filled.dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: (b?.x ?? 0) + 20,
      clientY: 840,
      button: 2,
    })
    await expect(menu(page)).toBeVisible()
    const box = await popoverBox(page)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(900)
  })

  test('empty, locked and set menus keep their rows, the rest disabled', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, empty } = await photoSetup(page)
    await empty.click({ button: 'right' })
    expect(await labels(menu(page))).toEqual([
      'Place photo…',
      ...EDIT,
      ...ORDER,
      'Lock',
      'Delete frame',
    ])
    await page.keyboard.press('Escape')

    // locked: Replace / Cut disabled; Remove, Fit, Crop, Copy, Duplicate, Delete enabled
    await filled.click()
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(filled).toHaveAttribute('data-locked', 'true')
    await filled.click({ button: 'right' })
    expect(await labels(menu(page))).toEqual([
      ...FILLED.slice(0, 12),
      'Unlock',
      'Delete frame',
    ])
    const off = await disabled(menu(page))
    expect(off).toEqual(
      expect.arrayContaining(['frame-menu-replace', 'frame-menu-cut']),
    )
    for (const id of ['remove', 'fit', 'crop', 'copy', 'duplicate', 'delete']) {
      expect(off).not.toContain(`frame-menu-${id}`)
    }
    await page.keyboard.press('Escape')

    // a set: no photo group, Delete 2 frames
    await empty.click({ modifiers: ['Shift'] })
    await empty.click({ button: 'right' })
    expect(await labels(menu(page))).toEqual([
      ...EDIT,
      ...ORDER,
      'Lock',
      'Delete 2 frames',
    ])
    await expect(menu(page).getByRole('separator')).toHaveCount(2)
  })

  test('Shift+F10 focuses the first enabled row', async ({ page }) => {
    test.setTimeout(120_000)
    const { filled } = await photoSetup(page)
    await filled.click()
    await expect(filled).toBeFocused()
    await page.keyboard.press('Shift+F10')
    await expect(menu(page)).toBeVisible()
    await expect(row(page, 'replace')).toBeFocused()
    await expect(row(page, 'replace')).toHaveAttribute('data-focused', 'true')
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
  })

  test('Duplicate, Fit ↔ Fill and Delete are one undo step each', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, empty, frames } = await photoSetup(page)
    const before = await undoLabel(page)

    await filled.click({ button: 'right' })
    await row(page, 'duplicate').click()
    await expect(frames).toHaveCount(3)
    await page.keyboard.press('Control+z')
    await expect(frames).toHaveCount(2)
    expect(await undoLabel(page)).toBe(before)

    await filled.click({ button: 'right' })
    await row(page, 'fit').click()
    await filled.click({ button: 'right' })
    await expect(row(page, 'fit')).toHaveText('Fill frame')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+z')
    expect(await undoLabel(page)).toBe(before)
    await filled.click({ button: 'right' })
    await expect(row(page, 'fit')).toHaveText('Fit photo to frame')
    await page.keyboard.press('Escape')
    // Esc again drops the selection: the selected photo's extent covers B
    await page.keyboard.press('Escape')
    await expect(filled).not.toHaveAttribute('aria-pressed', 'true')

    await empty.click({ button: 'right' })
    await row(page, 'delete').click()
    await expect(frames).toHaveCount(1)
    await page.keyboard.press('Control+z')
    await expect(frames).toHaveCount(2)
    expect(await undoLabel(page)).toBe(before)
  })

  test('Replace photo… picks thumb 3 in one undo step; Esc cancels with no op', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const { filled, assets } = await photoSetup(page)
    const before = await undoLabel(page)
    const strip = page.getByTestId('filmstrip')
    await filled.click({ button: 'right' })
    await row(page, 'replace').click()
    await expect(strip).toHaveAttribute('data-picking', '')
    await expect(page.getByTestId('editor-status')).toHaveText(
      'Click a photo in the filmstrip to replace this one · Esc to cancel',
    )
    await page.keyboard.press('Escape')
    await expect(strip).not.toHaveAttribute('data-picking')
    expect(await undoLabel(page)).toBe(before)

    await filled.click({ button: 'right' })
    await row(page, 'replace').click()
    await thumbs(page).nth(2).click()
    await expect(filled).toHaveAttribute('data-asset-id', assets[2] ?? '')
    expect(await undoLabel(page)).toBe('Undo “Replace photo” (Ctrl+Z)')
    await page.keyboard.press('Control+z')
    await expect(filled).toHaveAttribute('data-asset-id', assets[0] ?? '')
  })
})

test.describe('Page menu (M6)', () => {
  const canvas = (page: Page) => page.getByTestId('pasteboard-scroll')
  const spread = (page: Page) =>
    canvas(page).locator(
      '[data-spread-id="spread-2"] [data-testid="spread-view"]',
    )
  const frames = (page: Page) => spread(page).getByTestId('spread-frame')

  /** A frame's box relative to its spread view. */
  const local = (frame: Locator) =>
    frame.evaluate((el) => {
      const f = el.getBoundingClientRect()
      const s = el
        .closest('[data-testid="spread-view"]')
        ?.getBoundingClientRect()
      return { x: f.x - (s?.x ?? 0), y: f.y - (s?.y ?? 0) }
    })

  /** Screen px of 5 mm, from an Escape-cancelled Frame tool draw. */
  async function stepPx(page: Page): Promise<number> {
    const s = await spread(page).boundingBox()
    const x = (s?.x ?? 0) + (s?.width ?? 0) / 2
    const y = (s?.y ?? 0) + (s?.height ?? 0) - 6
    await page.keyboard.press('f')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 100, y - 100, { steps: 3 })
    const size = await page
      .getByTestId('frame-draft')
      .getAttribute('data-size-mm')
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await page.keyboard.press('v')
    return (STEP_MM * 100) / Number(size?.split('x')[0])
  }

  test('menu Copy, then the page menu Paste lands +5 mm in one undo step', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await expect(frames(page)).toHaveCount(2)
    await spread(page).scrollIntoViewIfNeeded()
    // 5 mm at Fit of this book (10.6 px is the kit demo book's size)
    const step = await stepPx(page)
    expect(step).toBeGreaterThan(5)
    const s = await spread(page).boundingBox()
    // the bottom margin holds no frame
    const paper = { x: (s?.x ?? 0) + 40, y: (s?.y ?? 0) + (s?.height ?? 0) - 6 }

    // nothing copied: no page menu (the browser menu stays)
    await page.mouse.click(paper.x, paper.y, { button: 'right' })
    await expect(page.getByTestId('page-menu')).toHaveCount(0)

    const src = frames(page).first()
    const from = await local(src)
    await src.click({ button: 'right' })
    await row(page, 'copy').click()
    await expect(page.getByTestId('editor-status')).toHaveText('Copied frame')
    const before = await undoLabel(page)

    await page.mouse.click(paper.x, paper.y, { button: 'right' })
    const pageMenu = page.getByTestId('page-menu')
    await expect(pageMenu).toBeVisible()
    expect(await labels(pageMenu)).toEqual(['Paste', 'Paste in place'])
    await expect(pageMenu.locator('[data-focused]')).toHaveCount(0)
    await page.getByTestId('page-menu-paste').click()
    await expect(frames(page)).toHaveCount(3)
    const pasted = frames(page).and(page.locator('[aria-pressed="true"]'))
    await expect(pasted).toHaveCount(1)
    const to = await local(pasted)
    expect(Math.abs(to.x - from.x - step)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(to.y - from.y - step)).toBeLessThanOrEqual(0.5)
    await page.keyboard.press('Control+z')
    await expect(frames(page)).toHaveCount(2)
    expect(await undoLabel(page)).toBe(before)
  })
})
