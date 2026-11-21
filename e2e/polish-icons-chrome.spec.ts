import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt } from './fixtures/paintProbe'

// Designer walkthrough-polish-review (2026-11-20), item 4 polish-icons-chrome:
// P6 icon stroke by size, P8 Publish = the top bar's one ink pill, P9 canvas
// dots at .30. Prod (`/`) and kit (`/uikit/#/demo`) hold the same numbers.

test.use({ viewport: { width: 1440, height: 900 } })

const INK = 'rgb(35, 34, 35)'
const INK_HOVER = 'rgb(58, 56, 57)'
const ON_INK = 'rgb(242, 242, 242)'
const QUIET = 'rgb(215, 215, 215)'
const SHADOW_XS = 'rgba(20, 20, 19, 0.06) 0px 1px 2px 0px'
const DOT = 'rgba(255, 255, 255, 0.3)'
/** Rendered icon width → stroke (P6). */
const STROKE: Record<string, string> = {
  '10': '2px',
  '12': '1.5px',
  '14': '1.5px',
  '16': '1.75px',
}

const look = (pill: Locator) =>
  pill.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      height: el.getBoundingClientRect().height,
      padding: s.padding,
      font: `${s.fontSize} ${s.fontWeight}`,
      bg: s.backgroundColor,
      color: s.color,
      shadow: s.boxShadow,
      outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.outlineOffset}`,
    }
  })

/** Rest, hover and keyboard focus of the Publish pill; Preview stays quiet. */
async function expectInkPill(page: Page, pill: Locator, preview: Locator) {
  await page.mouse.move(4, 450)
  const rest = await look(pill)
  expect(rest).toMatchObject({
    height: 32,
    padding: '0px 12px',
    font: '13px 500',
    bg: INK,
    color: ON_INK,
  })
  expect(rest.shadow).toContain(SHADOW_XS)
  expect((await look(preview)).bg).toBe(QUIET)

  const box = await pill.boundingBox()
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 16,
  )
  await expect.poll(async () => (await look(pill)).bg).toBe(INK_HOVER)
  const [[r = 0, g = 0, b = 0] = []] = await pixelsAt(pill, [{ x: 6, y: 16 }])
  expect([r, g, b]).toEqual([58, 56, 57])

  await page.mouse.move(4, 450)
  await page.keyboard.press('Shift')
  await pill.focus()
  // Colours transition (.15 s): poll until settled.
  await expect
    .poll(async () => {
      const { outline, bg } = await look(pill)
      return { outline, bg }
    })
    .toEqual({ outline: `solid 2px ${INK_HOVER} 2px`, bg: INK })
  expect((await look(pill)).shadow).toContain(SHADOW_XS)
}

/** Stroke widths of the visible icons, keyed by rendered width. */
const strokes = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const out: Record<string, string[]> = {}
    for (const el of document.querySelectorAll(sel)) {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w === 0) continue
      ;(out[String(w)] ??= []).push(getComputedStyle(el).strokeWidth)
    }
    return out
  }, selector)

function expectStrokes(found: Record<string, string[]>, need: string[]) {
  for (const [w, stroke] of Object.entries(STROKE)) {
    const got = found[w] ?? []
    if (need.includes(w))
      expect(got.length, `${w} px icons`).toBeGreaterThanOrEqual(3)
    for (const s of got) expect(s, `${w} px icon`).toBe(stroke)
  }
}

/** Dot centre vs tile middle on an empty canvas corner: white at .30. */
async function expectQuietDots(canvas: Locator) {
  // The token resolved as a colour (the build may minify it to #ffffff4d).
  const dotColor = await canvas.evaluate((el) => {
    const probe = el.appendChild(document.createElement('i'))
    probe.style.color = 'var(--dot)'
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  })
  expect(dotColor).toBe(DOT)
  const [[dr = 0, dg = 0, db = 0] = [], [cr = 0, cg = 0, cb = 0] = []] =
    await pixelsAt(canvas, [
      { x: 16, y: 16 },
      { x: 24, y: 24 },
    ])
  expect([cr, cg, cb]).toEqual([200, 202, 203])
  // 200 + .30 × 55 ≈ 216.5 (the .55 dot painted ≈ 230).
  for (const [dot, base] of [
    [dr, cr],
    [dg, cg],
    [db, cb],
  ] as const) {
    expect(dot - base).toBeGreaterThanOrEqual(13)
    expect(dot - base).toBeLessThanOrEqual(19)
  }
}

test('prod: Publish ink pill, icon strokes by size, dots at .30', async ({
  page,
}) => {
  await openLibraryBook(page)
  const pill = page.getByTestId('publish')
  await expect(pill).toBeEnabled()
  await expectInkPill(page, pill, page.getByTestId('present'))
  expectStrokes(await strokes(page, 'svg.pb-icon'), ['14', '16'])
  await expectQuietDots(page.getByTestId('editor-workspace'))
})

test('prod: 10 px status glyphs stroke 2, 12 px icons 1.5', async ({
  page,
}) => {
  await openLibraryBook(page)
  // The glyphs render in a probe row inside the app, so the app CSS applies.
  await page.evaluate(() => {
    const row = document.body.appendChild(document.createElement('div'))
    row.dataset.testid = 'stroke-probe'
    const chip = (cls: string, size: string) =>
      `<span class="${cls}" style="position:static"><svg class="pb-icon" data-size="${size}" viewBox="0 0 24 24"></svg></span>`
    row.innerHTML = [
      chip('filmstrip-lowres', '14'),
      chip('filmstrip-placed', '14'),
      chip('filmstrip-lowres', '14'),
      chip('x', '12'),
      chip('x', '12'),
      chip('x', '12'),
    ].join('')
  })
  expectStrokes(await strokes(page, '[data-testid="stroke-probe"] svg'), [
    '10',
    '12',
  ])
})

test('kit #/demo: Publish ink pill, lucide strokes by size, dots at .30', async ({
  page,
}) => {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (
      window as unknown as {
        __demo: {
          reset: () => void
          state: () => { path: string; books: unknown[]; open: string }
          go: (view: string) => void
        }
      }
    ).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = [
      {
        id: 's1',
        title: 'Lake trip',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    d.state().open = 's1'
    d.go('editor')
  })
  const pill = page.getByTestId('demo-publish')
  await expect(pill).toBeEnabled()
  await expectInkPill(page, pill, page.getByTestId('demo-preview'))
  expectStrokes(await strokes(page, 'svg.lucide'), ['14', '16'])
  await expectQuietDots(page.locator('.canvas-dots').last())
  // The empty book shows no 10 px status glyph (placed check, Low-res) and
  // few 12 px icons: probe the kit's sizing patterns in the page.
  await page.evaluate(() => {
    const row = document.body.appendChild(document.createElement('div'))
    row.dataset.testid = 'stroke-probe'
    const icon = (cls: string) =>
      `<svg class="lucide ${cls}" viewBox="0 0 24 24"></svg>`
    row.innerHTML = [
      icon('size-2.5'),
      icon('size-2.5'),
      icon('size-2.5'),
      // A parent's [&_svg]:size-4 beats the icon's own size-3: 16 px, 1.75.
      `<span class="[&_svg]:size-4">${icon('size-3')}</span>`,
      icon('size-3'),
      `<span class="[&_svg]:size-3">${icon('')}</span>`,
      `<span class="[&>svg]:size-3">${icon('')}</span>`,
    ].join('')
  })
  expectStrokes(await strokes(page, '[data-testid="stroke-probe"] svg'), [
    '10',
    '12',
  ])
})
