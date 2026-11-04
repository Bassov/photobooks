import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { layoutTile } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Design review r2 M21: the Spread inspector Layout picker = kit `#/demo`
// (uikit/src/sandbox/context-inspector.tsx:92-195, chrome.tsx:241). Kit values
// below were measured from `#/demo` at 1440×900 (Step 0, 2026-10-31).

/**
 * Kit builtin layouts on the one-page first spread, Owner 2026-11-02 order:
 * by photo count, kit order (uikit `data.ts` templates + `templates.ts` EXTRA)
 * inside a count.
 */
const FIRST_SPREAD_LAYOUTS = [
  'Full bleed',
  'One per page',
  'Panorama',
  'Framed single',
  'Offset pair',
  'Two portraits',
  'Hero + two',
  'Three across',
  'Landscape + 2 portraits',
  'Hero + grid',
]
/** Spread 2–3: One per page holds two photos; Two portraits merges into it. */
const SPREAD_2_3_LAYOUTS = [
  'Full bleed',
  'Panorama',
  'Framed single',
  'One per page',
  'Offset pair',
  'Hero + two',
  'Three across',
  'Landscape + 2 portraits',
  'Hero + grid',
]
/**
 * Owner 2026-11-02 (layout-tile-states): the thumb takes the trim aspect
 * (clamped 2:3–2:1) and single pages use 3 columns. 268 px grid, gap 6 px.
 * Spread 2–3 (2:1) keeps the kit 2-column boxes; page 1 is a square page.
 */
const SPREAD_TILES = {
  columns: 2,
  tile: { width: 131, height: 69.5 },
  thumb: { width: 123, height: 61.5 },
}
const PAGE_TILES = {
  columns: 3,
  tile: { width: 256 / 3, height: 256 / 3 },
  thumb: { width: 256 / 3 - 8, height: 256 / 3 - 8 },
}
const GRID_GAP = 6
/** Paper box-shadows (kit tokens: --select #232223, --ring #3a3839, panel --background #e1e1e1). */
const PAPER_IDLE = 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px'
const PAPER_HOVER =
  'rgba(0, 0, 0, 0.22) 0px 0px 0px 1px, rgba(0, 0, 0, 0.12) 0px 2px 6px 0px'
const PAPER_SELECTED = 'rgb(35, 34, 35) 0px 0px 0px 2px'
const PAPER_FOCUS =
  'rgb(225, 225, 225) 0px 0px 0px 2px, rgb(58, 56, 57) 0px 0px 0px 4px'
const LIFT = 'matrix(1, 0, 0, 1, 0, -1)'

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('layout-section')).toBeVisible()
  // Hover paints the tile; keep the pointer off the panel.
  await page.mouse.move(0, 899)
})

const allTiles = (page: Page) =>
  page.getByTestId('layout-section').getByTestId('layout-tile')

/** Tile names (their tooltips) in list order. */
const tileNames = (page: Page) =>
  allTiles(page).evaluateAll((tiles) =>
    tiles.map((tile) => tile.getAttribute('title')),
  )

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

async function stayOnFirstSpread(page: Page) {
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Page 1 · \d+ empty$/,
  )
}

async function selectSecondSpread(page: Page) {
  await page.locator('[data-testid^="spread-list-item-"]').nth(1).click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Pages 2–3 · \d+ empty$/,
  )
  await page.mouse.move(0, 899)
}

test('the Layout header is the kit Section: uppercase LAYOUT, + action, selected name expanded and collapsed', async ({
  page,
}) => {
  const layout = page.getByTestId('layout')
  const trigger = layout.locator('.pb-disclosure__trigger')
  await expect(trigger).toHaveAccessibleName('Layout')
  const eyebrow = trigger.locator('.inspector-eyebrow')
  await expect(eyebrow).toHaveText('Layout')
  const style = await eyebrow.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      transform: s.textTransform,
      size: s.fontSize,
      weight: s.fontWeight,
      tracking: s.letterSpacing,
    }
  })
  expect(style).toEqual({
    transform: 'uppercase',
    size: '11px',
    weight: '600',
    tracking: '0.66px',
  })
  expect(await eyebrow.innerText()).toBe('LAYOUT')
  await expect(layout.getByTestId('tpl-save')).toHaveAccessibleName(
    'Save as template',
  )
  // Owner 2026-11-02: the header names the selected layout, open or closed.
  await layoutTile(page, 'Hero + two').click()
  await expect(page.getByTestId('layout-note')).toHaveText('· Hero + two')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('layout-note')).toHaveText('· Hero + two')
  await expect(page.getByTestId('layout-summary')).toHaveCount(0)
  await expect(layout.getByTestId('tpl-save')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByTestId('layout-note')).toHaveText('· Hero + two')
})

test('the spread inspector: kit header, no Spread properties, sections in order (M2)', async ({
  page,
}) => {
  const header = page.getByTestId('inspector-header')
  await expect(header.getByTestId('inspector-context')).toHaveText('Spread')
  // Owner design change (round 7, M54): the inspector has no hide button of
  // its own; the top-bar toggle stays.
  await expect(header.getByTestId('panel-collapse-right')).toHaveCount(0)
  const body = page.getByTestId('inspector-body')
  await expect(body.getByText('Spread properties')).toHaveCount(0)
  // Kit `#/demo` spread context (Step 0): Layout, Master & spacing,
  // Background, Grid, each an uppercase Section header.
  const titles = body.locator('.inspector-eyebrow')
  await expect(titles).toHaveText([
    'Layout',
    'Master & spacing',
    'Background',
    'Grid',
  ])
  for (const title of await titles.all()) {
    await expect(title).toHaveCSS('text-transform', 'uppercase')
  }
})

test('My templates shows a readable one-line empty state', async ({ page }) => {
  // Page 1 asks for a page; this is the two-page copy.
  await selectSecondSpread(page)
  await page.getByTestId('tab-mine').click()
  await expect(allTiles(page)).toHaveCount(0)
  const empty = page.getByTestId('tpl-empty')
  // Kit tpl-empty copy (context-inspector.tsx:191).
  await expect(empty).toHaveText('No templates yet. Save a spread you like.')
  // Kit tpl-empty is a p-4 box; its text sits on one line.
  const text = await empty.evaluate((el) => {
    // The copy only: the kit LayoutTemplate glyph sits on its own row above.
    const copy = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)
    if (copy === undefined) throw new Error('no copy')
    const range = document.createRange()
    range.selectNodeContents(copy)
    const rect = range.getBoundingClientRect()
    return {
      width: rect.width,
      height: rect.height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    }
  })
  expect(text.width).toBeGreaterThan(80)
  expect(text.height).toBeLessThanOrEqual(text.lineHeight + 0.5)
})

test('every spread inspector text renders in the kit Inter face', async ({
  page,
}) => {
  // Kit preflight makes buttons inherit Inter; without it the section
  // triggers, tabs, chips and tile captions fall back to the UA's Arial.
  const offFace = await page
    .getByTestId('inspector-panel')
    .evaluate((root) =>
      [...root.querySelectorAll('*')]
        .filter(
          (el) =>
            [...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
            ) &&
            !getComputedStyle(el).fontFamily.startsWith('"Inter Variable"'),
        )
        .map((el) => el.textContent.trim()),
    )
  expect(offFace).toEqual([])
})

test('the list holds the kit layouts by photo count, merged on spread 2–3', async ({
  page,
}) => {
  await expect.poll(() => tileNames(page)).toEqual(FIRST_SPREAD_LAYOUTS)
  await selectSecondSpread(page)
  await expect.poll(() => tileNames(page)).toEqual(SPREAD_2_3_LAYOUTS)
})

test('a single page lays tiles out in 3 columns, a spread in 2; the paper fills the thumb', async ({
  page,
}) => {
  for (const [select, count, want] of [
    [stayOnFirstSpread, FIRST_SPREAD_LAYOUTS.length, PAGE_TILES],
    [selectSecondSpread, SPREAD_2_3_LAYOUTS.length, SPREAD_TILES],
  ] as const) {
    await select(page)
    const tiles = allTiles(page)
    await expect(tiles).toHaveCount(count)
    await expect(tiles.getByTestId('tpl-name')).toHaveCount(0)
    const columns = await page
      .getByTestId('tpl-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' '))
    expect(columns).toHaveLength(want.columns)
    for (let i = 0; i < count; i += 1) {
      const tile = await box(tiles.nth(i))
      expect(Math.abs(tile.width - want.tile.width)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(tile.height - want.tile.height)).toBeLessThanOrEqual(0.5)
      const thumb = await box(tiles.nth(i).getByTestId('layout-thumb'))
      expect(Math.abs(thumb.width - want.thumb.width)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(thumb.height - want.thumb.height)).toBeLessThanOrEqual(
        0.5,
      )
      // No side areas: the paper is the thumb box.
      const paper = await box(tiles.nth(i).getByTestId('layout-thumb-paper'))
      for (const k of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(paper[k] - thumb[k])).toBeLessThanOrEqual(1)
      }
    }
    const first = await box(tiles.nth(0))
    const second = await box(tiles.nth(1))
    const nextRow = await box(tiles.nth(want.columns))
    expect(
      Math.abs(second.x - first.x - want.tile.width - GRID_GAP),
    ).toBeLessThanOrEqual(0.5)
    expect(Math.abs(nextRow.x - first.x)).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs(nextRow.y - first.y - want.tile.height - GRID_GAP),
    ).toBeLessThanOrEqual(0.5)
  }
  const tileStyle = await allTiles(page)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        padding: s.padding,
        radius: s.borderRadius,
        bg: s.backgroundColor,
      }
    })
  expect(tileStyle).toEqual({
    padding: '4px',
    radius: '8px',
    bg: 'rgba(0, 0, 0, 0)',
  })
})

test('My templates keep the kit caption box and type', async ({ page }) => {
  await reopenEditor(page, '?templates=kit')
  await selectSecondSpread(page)
  // The caption wrap depends on Inter's metrics: measure after the
  // self-hosted face (font-display: swap) has replaced the fallback.
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check('11px "Inter Variable"')),
    )
    .toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('tab-mine').click()
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveCount(
    KIT_SAVED.length,
  )
  const caption = await allTiles(page)
    .getByTestId('tpl-name')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        family: s.fontFamily,
        size: s.fontSize,
        lineHeight: s.lineHeight,
        weight: s.fontWeight,
        marginTop: s.marginTop,
        clamp: s.webkitLineClamp,
        overflow: s.overflow,
      }
    })
  expect(caption).toEqual({
    // Kit preflight: the tile button inherits Inter (UA default is Arial).
    family: '"Inter Variable", Inter, sans-serif',
    size: '11px',
    lineHeight: '15.125px',
    weight: '400',
    marginTop: '4px',
    clamp: '2',
    overflow: 'hidden',
  })
})

/** Tile fill, paper ring and paper transform, once transitions settle. */
function tileState(tile: Locator) {
  return () =>
    tile.evaluate((el) => {
      const paper = el.querySelector('[data-testid="layout-thumb-paper"]')
      if (paper === null) throw new Error('no paper')
      const p = getComputedStyle(paper)
      return {
        tileBg: getComputedStyle(el).backgroundColor,
        tileShadow: getComputedStyle(el).boxShadow,
        ring: p.boxShadow,
        transform: p.transform,
      }
    })
}

test('hover lifts the paper with a ring; the selected paper has the ink ring; the tile stays clear', async ({
  page,
}) => {
  const tile = layoutTile(page, 'Panorama')
  const state = tileState(tile)
  const clear = { tileBg: 'rgba(0, 0, 0, 0)', tileShadow: 'none' }
  expect(await state()).toEqual({
    ...clear,
    ring: PAPER_IDLE,
    transform: 'none',
  })
  await tile.hover()
  await expect
    .poll(state)
    .toEqual({ ...clear, ring: PAPER_HOVER, transform: LIFT })
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
  // Selected wins over hover: no lift under the pointer either.
  await expect
    .poll(state)
    .toEqual({ ...clear, ring: PAPER_SELECTED, transform: 'none' })
  await page.mouse.move(0, 899)
  await expect
    .poll(state)
    .toEqual({ ...clear, ring: PAPER_SELECTED, transform: 'none' })
  await expect(tile.getByTestId('tpl-name')).toHaveCount(0)
})

test('keyboard focus rings the paper with a panel-colour gap, not the tile', async ({
  page,
}) => {
  await allTiles(page).first().focus()
  await page.keyboard.press('Tab')
  const tile = allTiles(page).nth(1)
  await expect(tile).toBeFocused()
  expect(await tile.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await expect.poll(tileState(tile)).toEqual({
    tileBg: 'rgba(0, 0, 0, 0)',
    tileShadow: 'none',
    ring: PAPER_FOCUS,
    transform: 'none',
  })
})

/**
 * Columns of the tile left / right of the paper (over the thumb rows) are one
 * flat colour: no stray bleed lines at the tile edges.
 */
async function edgeColumnsAreFlat(page: Page, tile: Locator) {
  const tileBox = await box(tile)
  const thumb = await box(tile.getByTestId('layout-thumb'))
  const paper = await box(tile.getByTestId('layout-thumb-paper'))
  const png = (await tile.screenshot({ scale: 'css' })).toString('base64')
  const scratch = await page.context().newPage()
  try {
    return await scratch.evaluate(
      async ({ png, top, bottom, left, right }) => {
        const img = new Image()
        img.src = `data:image/png;base64,${png}`
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx === null) throw new Error('no 2d context')
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, img.width, img.height)
        const at = (x: number, y: number) => {
          const i = (y * img.width + x) * 4
          return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
        }
        const ref = at(0, top)
        const off: string[] = []
        for (let x = 0; x < img.width; x += 1) {
          // Skip the paper and its 1 px hairline ring.
          if (x >= left - 2 && x <= right + 1) continue
          for (let y = top; y < bottom; y += 1) {
            const px = at(x, y)
            if (px.some((v, k) => Math.abs(v - (ref[k] ?? 0)) > 3)) {
              off.push(`${String(x)},${String(y)}`)
              break
            }
          }
        }
        return off
      },
      {
        png,
        top: Math.ceil(thumb.y - tileBox.y),
        bottom: Math.floor(thumb.y + thumb.height - tileBox.y),
        left: Math.floor(paper.x - tileBox.x),
        right: Math.ceil(paper.x + paper.width - tileBox.x),
      },
    )
  } finally {
    await scratch.close()
  }
}

test('the Full bleed thumb is clipped to the paper with no edge lines', async ({
  page,
}) => {
  for (const select of [stayOnFirstSpread, selectSecondSpread]) {
    await select(page)
    const tile = layoutTile(page, 'Full bleed')
    const tileBox = await box(tile)
    const paperEl = tile.getByTestId('layout-thumb-paper')
    const paper = await box(paperEl)
    await expect(paperEl).toHaveCSS('overflow', 'hidden')
    const slots = tile.getByTestId('layout-thumb-slot')
    await expect(slots).toHaveCount(1)
    const slot = await box(slots.first())
    // Exact inset: the bleed slot is the paper, never past it.
    expect(Math.abs(slot.x - paper.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(slot.y - paper.y)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(slot.width - paper.width)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(slot.height - paper.height)).toBeLessThanOrEqual(0.5)
    expect(slot.x).toBeGreaterThanOrEqual(tileBox.x)
    expect(slot.y).toBeGreaterThanOrEqual(tileBox.y)
    expect(slot.x + slot.width).toBeLessThanOrEqual(tileBox.x + tileBox.width)
    expect(slot.y + slot.height).toBeLessThanOrEqual(tileBox.y + tileBox.height)
    expect(await edgeColumnsAreFlat(page, tile)).toEqual([])
    // Grey slot on a clear tile: the hover state reads as the paper ring.
    await tile.hover()
    await expect.poll(tileState(tile)).toMatchObject({
      tileBg: 'rgba(0, 0, 0, 0)',
      ring: PAPER_HOVER,
    })
    await page.mouse.move(0, 899)
  }
})

test('hovering a tile previews its slots on the spread; leaving clears it', async ({
  page,
}) => {
  const tile = layoutTile(page, 'Full bleed')
  await tile.hover()
  const preview = page.getByTestId('tpl-preview')
  await expect(preview).toHaveCount(1)
  await expect(preview).toHaveAttribute('data-template', 'full-bleed')
  await expect(preview).toContainText('Preview · Full bleed')
  const spread = await box(
    page.getByTestId('spread-view').filter({ has: preview }),
  )
  const slot = await box(preview.getByTestId('tpl-preview-slot'))
  expect(slot.x).toBeGreaterThanOrEqual(spread.x - 0.5)
  expect(slot.y).toBeGreaterThanOrEqual(spread.y - 0.5)
  expect(slot.x + slot.width).toBeLessThanOrEqual(spread.x + spread.width + 0.5)
  expect(slot.y + slot.height).toBeLessThanOrEqual(
    spread.y + spread.height + 0.5,
  )
  await page.mouse.move(0, 899)
  await expect(preview).toHaveCount(0)
  // Keyboard focus previews too; applying clears the preview.
  await layoutTile(page, 'Hero + two').focus()
  await expect(preview.getByTestId('tpl-preview-slot')).toHaveCount(3)
  await page.keyboard.press('Enter')
  await expect(layoutTile(page, 'Hero + two')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(preview).toHaveCount(0)
})

/** Kit `#/demo` "My templates" (uikit sandbox `templates.ts`), in kit order. */
const KIT_SAVED = ['Travel opener', 'Polaroid pair', 'Quote + photo']

/** Reload into the session editor; `search` may carry the `?templates=kit` seed. */
async function reopenEditor(page: Page, search = '') {
  await page.goto(`/${search}`)
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('layout-section')).toBeVisible({
    timeout: 15_000,
  })
  await page.mouse.move(0, 899)
}

test('the kit fixture shows All 12 / My templates 3 by photo count on spread 2–3', async ({
  page,
}) => {
  await reopenEditor(page, '?templates=kit')
  // The kit seeds are two-page layouts (Designer spec user-templates UT1).
  await selectSecondSpread(page)
  await expect(page.getByTestId('tab-all')).toHaveText('All 12')
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 3')
  // Saved layouts follow the builtins of their photo count (1, 2, 2).
  await expect
    .poll(() => tileNames(page))
    .toEqual([
      'Full bleed',
      'Panorama',
      'Framed single',
      'Quote + photo',
      'One per page',
      'Offset pair',
      'Travel opener',
      'Polaroid pair',
      'Hero + two',
      'Three across',
      'Landscape + 2 portraits',
      'Hero + grid',
    ])
  // Only the user's templates carry a visible caption.
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText([
    'Quote + photo',
    'Travel opener',
    'Polaroid pair',
  ])
  await page.getByTestId('tab-mine').click()
  await expect
    .poll(() => tileNames(page))
    .toEqual(['Quote + photo', 'Travel opener', 'Polaroid pair'])
})

test('page 1 offers no two-page template: My templates 0 asks for a page', async ({
  page,
}) => {
  await reopenEditor(page, '?templates=kit')
  await stayOnFirstSpread(page)
  await expect(page.getByTestId('tab-all')).toHaveText('All 10')
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 0')
  await page.getByTestId('tab-mine').click()
  await expect(allTiles(page)).toHaveCount(0)
  await expect(page.getByTestId('tpl-empty')).toHaveText(
    'No templates yet. Save a page you like.',
  )
})

async function selectLastSpread(page: Page) {
  // The spread list is virtualized: bring the last row in first.
  await page.getByTestId('spreads-list').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.locator('[data-testid^="spread-list-item-"]').last().click()
  // The session book's third spread is its last page (the summary's page
  // label is not asserted here).
  await expect(page.getByTestId('inspector-spread-summary')).not.toHaveText(
    /^(Page 1|Pages 2–3) /,
  )
  await page.mouse.move(0, 899)
}

test('a template saved on page 1 is offered on page 1 and the last page, not on spread 2–3', async ({
  page,
}) => {
  await stayOnFirstSpread(page)
  await page.getByTestId('tpl-save').click()
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Saved “My layout 1” to My templates',
  )
  await page.getByTestId('tpl-rename-input').press('Enter')
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 1')
  await selectLastSpread(page)
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 1')
  await page.getByTestId('tab-mine').click()
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText([
    'My layout 1',
  ])
  await selectSecondSpread(page)
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 0')
  await expect(page.getByTestId('tpl-empty')).toHaveText(
    'No templates yet. Save a spread you like.',
  )
})

test('saving the same layout twice keeps one template and flashes its tile', async ({
  page,
}) => {
  await selectSecondSpread(page)
  await page.getByTestId('tpl-save').click()
  await page.getByTestId('tpl-rename-input').press('Enter')
  await page.getByTestId('tab-all').click()
  await page.getByTestId('tpl-save-button').click()
  await expect(page.getByTestId('editor-status')).toHaveText(
    'Already in My templates as “My layout 1”',
  )
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 1')
  await expect(page.getByTestId('tab-mine')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('tpl-rename-input')).toHaveCount(0)
  const tile = layoutTile(page, 'My layout 1')
  await expect(tile).toHaveAttribute('data-flash', '')
  await page.mouse.move(0, 899)
  // Flash = the hover look (ring + 1 px lift), then back to idle.
  const paper = () =>
    tileState(tile)().then(({ ring, transform }) => ({ ring, transform }))
  await expect.poll(paper).toEqual({ ring: PAPER_HOVER, transform: LIFT })
  await expect(tile).not.toHaveAttribute('data-flash')
  await expect.poll(paper).toEqual({ ring: PAPER_IDLE, transform: 'none' })
})

/** `library.json` of the `?testLibrary=1` OPFS library, parsed. */
async function readTestLibraryJson(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('photobooks-e2e-library')
    const file = await (await dir.getFileHandle('library.json')).getFile()
    return JSON.parse(await file.text()) as unknown
  })
}

test('a new user has My templates 0; a saved spread appears in My templates and All and persists in library.json', async ({
  page,
}) => {
  // Templates live in the library folder: run in the OPFS test library.
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await page.mouse.move(0, 899)
  await expect(page.getByTestId('tab-all')).toHaveText('All 10')
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 0')
  await selectSecondSpread(page)
  await page.getByTestId('tpl-save').click()
  const input = page.getByTestId('tpl-rename-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('My layout 1')
  await input.fill('Trip opener')
  await input.press('Enter')
  await expect(input).toHaveCount(0)
  await expect(page.getByTestId('tab-mine')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 1')
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText([
    'Trip opener',
  ])
  await page.getByTestId('tab-all').click()
  // Spread 2–3 lists 9 builtins (Two portraits merged) + the saved one, which
  // follows the 2-photo builtins (the spread has two frames).
  await expect(page.getByTestId('tab-all')).toHaveText('All 10')
  await expect
    .poll(() => tileNames(page))
    .toEqual([
      'Full bleed',
      'Panorama',
      'Framed single',
      'One per page',
      'Offset pair',
      'Trip opener',
      'Hero + two',
      'Three across',
      'Landscape + 2 portraits',
      'Hero + grid',
    ])

  await expect
    .poll(() => readTestLibraryJson(page))
    .toMatchObject({
      schemaVersion: 3,
      templates: [{ name: 'Trip opener', pages: 2 }],
    })

  await page.reload()
  await expect(page.getByTestId('layout-section')).toBeVisible({
    timeout: 15_000,
  })
  // The reload opens page 1; the saved layout is a two-page one.
  await selectSecondSpread(page)
  await expect(page.getByTestId('tab-mine')).toHaveText('My templates 1')
  await page.getByTestId('tab-mine').click()
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText([
    'Trip opener',
  ])
})

test('Master & spacing, Background and Grid match the kit boxes', async ({
  page,
}) => {
  await selectSecondSpread(page)
  // Kit #/demo, spread 2–3 at 1440 × 900 (Step 0 DOM measurements). A new
  // book has its default Master A (default-master): the kit's 170.59 with the
  // 24 + 4 px switch and 12 px gap becomes the 36 px select, 6 + 16.8 px
  // status line and 14 px gap.
  const sections = [
    ['spread-master-spacing', 170.59 - 28 - 12 + 36 + 6 + 16.8 + 14],
    ['spread-background', 95],
    ['grid', 176.53],
  ] as const
  for (const [testId, height] of sections) {
    const b = await box(page.getByTestId(testId))
    expect(b.width).toBeCloseTo(300, 0)
    expect(Math.abs(b.height - height)).toBeLessThanOrEqual(0.5)
  }
  await expect(page.getByRole('radiogroup', { name: 'Master' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Master' })).toHaveValue(/.+/)
  for (const testId of ['spread-margin', 'spread-gap']) {
    const row = page.getByTestId(testId)
    const value = await box(row.getByTestId('slider-value'))
    const track = await box(row.locator('.fit-crop-track'))
    expect(value.width).toBeCloseTo(64, 0)
    expect(Math.abs(value.height - 16.8)).toBeLessThanOrEqual(0.5)
    expect(track.width).toBeCloseTo(268, 0)
    expect(track.height).toBeCloseTo(3, 0)
    expect(Math.abs(track.y - value.y - 24.8)).toBeLessThanOrEqual(0.5)
  }
  const swatches = page.getByTestId('bg-swatches').getByRole('button')
  await expect(swatches).toHaveCount(6)
  const first = await box(swatches.nth(0))
  const second = await box(swatches.nth(1))
  expect([first.width, first.height]).toEqual([28, 28])
  expect(second.x - first.x).toBeCloseTo(34, 0)
})

test('Margin, Gap and Background write the spread', async ({ page }) => {
  await selectSecondSpread(page)
  const margin = page.getByTestId('spread-margin').getByTestId('slider-value')
  await margin.click()
  await margin.fill('12')
  await margin.press('Enter')
  await expect(margin).toHaveValue('12 mm')
  // The spread grid now overrides all four margins (Grid shows Custom).
  for (const field of ['top', 'bottom', 'inside', 'outside']) {
    await expect(page.getByTestId(`spread-grid-field-${field}`)).toHaveValue(
      '12',
    )
  }
  const gap = page.getByTestId('spread-gap').getByTestId('slider-value')
  await gap.fill('99')
  await gap.press('Enter')
  await expect(gap).toHaveValue('20 mm')
  await page
    .getByTestId('bg-swatches')
    .getByRole('button', { name: 'Background #2a2927' })
    .click()
  await expect(
    page
      .getByTestId('bg-swatches')
      .getByRole('button', { name: 'Background #2a2927' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('[data-testid="spread-view"][data-spread-id="spread-2"]'),
  ).toHaveCSS('background-color', 'rgb(42, 41, 39)')
})
