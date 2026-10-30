import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Kit reference values (uikit/ measured in the browser, px):
// left panel 212 (v0.10); list inset 12+4 and row p-2 → thumb box 180 wide; label
// line 14.85; inspector section px-4 py-4 (16), title text-2xs (11) with a
// 12px gap to the fields, fields h-8 (32) with gap-2 (8).
const KIT_PANEL_LEFT = 212
const KIT_THUMB_BOX = 180
const KIT_SECTION_PAD = 16
const KIT_TITLE_PX = 11
const KIT_TITLE_GAP = 12
const KIT_FIELD_H = 32
const KIT_FIELD_GAP = 8

const sizeOf = (locator: Locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return { w: box.width, h: box.height }
  })

async function openInspectorOnFrame(page: Page) {
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await page
    .getByTestId('spread-view')
    .first()
    .getByTestId('spread-frame')
    .first()
    .click()
  await expect(page.getByTestId('inspector-geometry')).toBeVisible()
}

test('left panel defaults to the kit width and thumbs keep the spread aspect', async ({
  page,
}) => {
  await openSessionEditor(page)
  const panel = await sizeOf(page.getByTestId('panel-l'))
  expect(panel.w).toBe(KIT_PANEL_LEFT)

  const spreadAspect = await page
    .getByTestId('spread-view')
    .first()
    .evaluate((el) => {
      const style = (el as HTMLElement).style
      return Number.parseFloat(style.width) / Number.parseFloat(style.height)
    })
  const thumb = await sizeOf(
    page.getByTestId('spreads-list').locator('.spread-view--thumb').first(),
  )
  expect(thumb.w / thumb.h / spreadAspect).toBeGreaterThan(0.98)
  expect(thumb.w / thumb.h / spreadAspect).toBeLessThan(1.02)
  // Kit box: panel 212 - list inset 16 - row padding 16.
  expect(Math.min(thumb.w, KIT_THUMB_BOX)).toBeCloseTo(thumb.w, 0)
  const box = await sizeOf(
    page.getByTestId('spreads-list').locator('.editor-spread-thumb').first(),
  )
  expect(box.w).toBeCloseTo(KIT_THUMB_BOX, 0)
})

test('inspector sections use the kit padding, title and field sizes', async ({
  page,
}) => {
  await openInspectorOnFrame(page)
  const section = page.getByTestId('inspector-geometry')
  const probe = await section.evaluate((el) => {
    const style = getComputedStyle(el)
    const title = el.querySelector('h4')
    const grid = el.querySelector('.grid')
    const field = el.querySelector('.frame-field')
    if (!title || !grid || !field) {
      throw new Error('geometry section parts missing')
    }
    const titleBox = (title.parentElement ?? title).getBoundingClientRect()
    const gridBox = grid.getBoundingClientRect()
    const fields = [...grid.children].slice(0, 2).map((item) => {
      return item.getBoundingClientRect()
    })
    return {
      padTop: Number.parseFloat(style.paddingTop),
      padBottom: Number.parseFloat(style.paddingBottom),
      padLeft: Number.parseFloat(style.paddingLeft),
      padRight: Number.parseFloat(style.paddingRight),
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      titleGap: gridBox.top - titleBox.bottom,
      fieldHeight: fields[0]?.height ?? 0,
      fieldGap: (fields[1]?.left ?? 0) - (fields[0]?.right ?? 0),
    }
  })
  expect(probe.padTop).toBe(KIT_SECTION_PAD)
  expect(probe.padBottom).toBe(KIT_SECTION_PAD)
  expect(probe.padLeft).toBe(KIT_SECTION_PAD)
  expect(probe.padRight).toBe(KIT_SECTION_PAD)
  expect(probe.titleSize).toBe(KIT_TITLE_PX)
  expect(probe.titleGap).toBe(KIT_TITLE_GAP)
  expect(probe.fieldHeight).toBe(KIT_FIELD_H)
  expect(probe.fieldGap).toBe(KIT_FIELD_GAP)
})

test('pasteboard hides its scrollbars yet still pans and zooms', async ({
  page,
}) => {
  await openSessionEditor(page)
  const scroll = page.getByTestId('pasteboard-scroll')
  const bars = () =>
    scroll.evaluate((node) => {
      const el = node as HTMLElement
      return {
        overflowsX: el.scrollWidth > el.clientWidth,
        overflowsY: el.scrollHeight > el.clientHeight,
        barX: el.offsetHeight - el.clientHeight,
        barY: el.offsetWidth - el.clientWidth,
        scrollbarWidth: getComputedStyle(el).scrollbarWidth,
      }
    })
  const initial = await bars()
  expect(initial.scrollbarWidth).toBe('none')
  expect(initial.barX).toBe(0)
  expect(initial.barY).toBe(0)

  // Wheel over the pasteboard zooms to the pointer: the scrollable extent changes.
  const box = await scroll.boundingBox()
  expect(box).not.toBeNull()
  const cx = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const cy = (box?.y ?? 0) + (box?.height ?? 0) / 2
  const heightBefore = await scroll.evaluate((el) => el.scrollHeight)
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -400)
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollHeight))
    .not.toBe(heightBefore)

  // Space-drag pans the view.
  await expect.poll(async () => (await bars()).overflowsY).toBe(true)
  const topBefore = await scroll.evaluate((el) => el.scrollTop)
  await page.mouse.move(cx, cy + 120)
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(cx, cy + 20)
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(topBefore)
  const after = await bars()
  expect(after.barX).toBe(0)
  expect(after.barY).toBe(0)
})
