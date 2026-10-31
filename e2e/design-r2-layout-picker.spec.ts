import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { layoutTile } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Design review r2 M21: the Spread inspector Layout picker = kit `#/demo`
// (uikit/src/sandbox/context-inspector.tsx:92-195, chrome.tsx:241). Kit values
// below were measured from `#/demo` at 1440×900 (Step 0, 2026-10-31).

/** Kit builtin layouts in kit order (uikit `data.ts` templates + `templates.ts` EXTRA). */
const KIT_LAYOUTS = [
  'Full bleed',
  'One per page',
  'Hero + two',
  'Hero + grid',
  'Panorama',
  'Three across',
  'Framed single',
  'Offset pair',
  'Two portraits',
  'Landscape + 2 portraits',
]
const KIT_TILE_WIDTH = 131
/** Kit tile heights in KIT_LAYOUTS order: the two-line caption is 15.125 px taller. */
const KIT_TILE_HEIGHTS = [
  88.625, 88.625, 88.625, 88.625, 88.625, 88.625, 88.625, 88.625, 88.625,
  103.75,
]
const KIT_THUMB = { width: 123, height: 61.5 }
/** Kit tile column step: 131 px tile + 6 px gap (grid-cols-2 gap-1.5). */
const KIT_COLUMN_STEP = 137

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('layout-section')).toBeVisible()
  // Hover paints the tile; keep the pointer off the panel.
  await page.mouse.move(0, 899)
})

const allTiles = (page: Page) =>
  page.getByTestId('layout-section').getByTestId('layout-tile')

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

test('the Layout header is the kit Section: uppercase LAYOUT, + action, summary when collapsed', async ({
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
  await layoutTile(page, 'Hero + two').click()
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('layout-summary')).toHaveText('Hero + two')
  await expect(layout.getByTestId('tpl-save')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByTestId('layout-summary')).toHaveCount(0)
})

test('the spread inspector: kit header, no Spread properties, sections in order (M2)', async ({
  page,
}) => {
  const header = page.getByTestId('inspector-header')
  await expect(header.getByTestId('inspector-context')).toHaveText('Spread')
  await expect(header.getByTestId('panel-collapse-right')).toHaveAccessibleName(
    'Hide inspector (I)',
  )
  const body = page.getByTestId('inspector-body')
  await expect(body.getByText('Spread properties')).toHaveCount(0)
  // Kit `#/demo` continues Master & spacing, Background, Grid: not built yet
  // (gap raised to the Owner in the design-r2-layout-picker PR).
  await expect(body.locator('.inspector-eyebrow')).toHaveText([
    'Layout',
    'Layout grid',
  ])
})

test('All layouts lists the kit layouts in kit order', async ({ page }) => {
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText(KIT_LAYOUTS)
  await selectSecondSpread(page)
  await expect(allTiles(page).getByTestId('tpl-name')).toHaveText(KIT_LAYOUTS)
})

test('tiles, thumbs, grid and captions match the kit boxes and type', async ({
  page,
}) => {
  for (const select of [stayOnFirstSpread, selectSecondSpread]) {
    await select(page)
    const tiles = allTiles(page)
    await expect(tiles).toHaveCount(KIT_LAYOUTS.length)
    for (let i = 0; i < KIT_LAYOUTS.length; i += 1) {
      const tile = await box(tiles.nth(i))
      expect(Math.abs(tile.width - KIT_TILE_WIDTH)).toBeLessThanOrEqual(0.5)
      expect(
        Math.abs(tile.height - (KIT_TILE_HEIGHTS[i] ?? 0)),
      ).toBeLessThanOrEqual(0.5)
      const thumb = await box(tiles.nth(i).getByTestId('layout-thumb'))
      expect(Math.abs(thumb.width - KIT_THUMB.width)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(thumb.height - KIT_THUMB.height)).toBeLessThanOrEqual(0.5)
    }
    const first = await box(tiles.nth(0))
    const second = await box(tiles.nth(1))
    const third = await box(tiles.nth(2))
    expect(Math.abs(second.x - first.x - KIT_COLUMN_STEP)).toBeLessThanOrEqual(
      0.5,
    )
    expect(Math.abs(third.x - first.x)).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs(third.y - first.y - (KIT_TILE_HEIGHTS[0] ?? 0) - 6),
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
  const caption = await allTiles(page)
    .getByTestId('tpl-name')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        size: s.fontSize,
        lineHeight: s.lineHeight,
        weight: s.fontWeight,
        marginTop: s.marginTop,
        clamp: s.webkitLineClamp,
        overflow: s.overflow,
      }
    })
  expect(caption).toEqual({
    size: '11px',
    lineHeight: '15.125px',
    weight: '400',
    marginTop: '4px',
    clamp: '2',
    overflow: 'hidden',
  })
})

test('the selected tile is filled; hover fills an idle tile', async ({
  page,
}) => {
  const tile = layoutTile(page, 'Panorama')
  const bg = () => tile.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await bg()).toBe('rgba(0, 0, 0, 0)')
  await tile.hover()
  const hovered = await bg()
  expect(hovered).not.toBe('rgba(0, 0, 0, 0)')
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(0, 899)
  const selected = await bg()
  expect(selected).not.toBe('rgba(0, 0, 0, 0)')
  await expect(tile.getByTestId('tpl-name')).toHaveCSS('font-weight', '600')
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
