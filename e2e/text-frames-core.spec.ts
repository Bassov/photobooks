import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { applyLayout, openSpreadTab } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

const TEXT = 'Morning on the lake'
const TEXT_RECT = { x: 20, y: 20, width: 60, height: 14 }

const spreadView = (page: Page) => page.getByTestId('spread-view').first()
const textFrame = (page: Page) =>
  spreadView(page).locator('[data-testid="spread-frame"][data-kind="text"]')

async function dispatch(
  page: Page,
  op: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((bookOp) => {
    const api = window.__photobooksProject
    if (!api?.dispatchBookOpForTests) {
      throw new Error('dispatchBookOpForTests missing')
    }
    api.dispatchBookOpForTests(bookOp)
  }, op)
}

/** World px per mm of the canvas painter, from the text frame's CSS width. */
async function pxPerMm(page: Page): Promise<number> {
  // Inline px, unrounded (offsetWidth rounds to whole px).
  const width = await textFrame(page).evaluate((el) =>
    parseFloat((el as HTMLElement).style.width),
  )
  return width / TEXT_RECT.width
}

test('text frames paint on the canvas, list thumbnail and Preview; layouts keep them', async ({
  page,
}) => {
  await openSessionEditor(page)
  const spreadId = await spreadView(page).getAttribute('data-spread-id')
  expect(spreadId).not.toBeNull()
  const photoFrameId = await spreadView(page)
    .locator('[data-testid="spread-frame"][data-filled]')
    .first()
    .getAttribute('data-frame-id')
  await dispatch(page, {
    type: 'addTextFrame',
    spreadId,
    rect: TEXT_RECT,
    id: 'e2e-text',
  })
  await dispatch(page, {
    type: 'editText',
    spreadId,
    frameId: 'e2e-text',
    text: TEXT,
  })
  await dispatch(page, {
    type: 'setFrameCaption',
    spreadId,
    frameId: photoFrameId,
    caption: 'By the sea',
  })

  // Canvas: Caption style at book scale, whole lines (3 × 4.34 mm in 14 mm).
  const text = textFrame(page).getByTestId('frame-text')
  await expect(text).toHaveText(TEXT)
  await expect(textFrame(page)).not.toHaveAttribute('data-filled')
  const scale = await pxPerMm(page)
  const css = await text.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      fontSize: parseFloat(s.fontSize),
      height: parseFloat(s.height),
      color: s.color,
      whiteSpace: s.whiteSpace,
    }
  })
  expect(css.fontSize).toBeCloseTo(3.1 * scale, 1)
  expect(css.height).toBeCloseTo(3 * 4.34 * scale, 1)
  expect(css.color).toBe('rgb(35, 34, 32)')
  expect(css.whiteSpace).toBe('pre-wrap')

  // Photo caption: 3.1 mm × px/mm (was a fixed 11 px).
  const captionSize = await spreadView(page)
    .getByTestId('frame-caption')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(captionSize).toBeCloseTo(3.1 * scale, 1)

  // List thumbnail paints the same text.
  await expect(
    page
      .getByTestId('spreads-list')
      .locator('.spread-frame-text', { hasText: TEXT })
      .first(),
  ).toBeAttached()

  // A layout re-lays the photos only: the text box stays where it was.
  const before = await textFrame(page).evaluate((el) => {
    const s = (el as HTMLElement).style
    return [s.left, s.top, s.width, s.height]
  })
  await openSpreadTab(page)
  await applyLayout(page, 'Full bleed')
  await expect(text).toHaveText(TEXT)
  const after = await textFrame(page).evaluate((el) => {
    const s = (el as HTMLElement).style
    return [s.left, s.top, s.width, s.height]
  })
  expect(after).toEqual(before)
  await assertDocumentFitsViewport(page)

  // Preview paints the text, never the editor-only placeholder.
  await page.getByTestId('present').click()
  const stage = page.getByTestId('site-preview')
  await expect(stage).toBeVisible()
  await expect(stage.getByTestId('frame-text').first()).toHaveText(TEXT)
})

const BODY_TEXT =
  'Body line one\nBody line two\nBody line three\nBody line four'
const BODY_RECT = { x: 20, y: 40, width: 60, height: 30 }
const TITLE_RECT = { x: 20, y: 80, width: 80, height: 14 }

/** Book text styles under test (src/render/textStyles.ts). */
const TEXT_FRAMES = [
  {
    id: 'e2e-body',
    rect: BODY_RECT,
    styleId: 'body',
    text: BODY_TEXT,
    sizeMm: 3.6,
    lineHeight: 1.5,
  },
  {
    id: 'e2e-title',
    rect: TITLE_RECT,
    styleId: 'title',
    text: 'Lake trip',
    sizeMm: 9,
    lineHeight: 1.15,
  },
] as const

interface LineTops {
  pxPerMm: number
  /** Screen px from the frame top, one per line. */
  tops: number[]
  /** The same text set unzoomed at its on-screen size (the reference). */
  reference: number[]
}

/** Line tops of a painted text frame and of its on-screen-size reference. */
async function lineTops(
  page: Page,
  scope: string,
  frame: (typeof TEXT_FRAMES)[number],
): Promise<LineTops> {
  return page.evaluate(
    ({ scope, frame }) => {
      const tops = (el: Element, origin: DOMRect): number[] => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const all = [...range.getClientRects()].map(
          (r) => Math.round((r.top - origin.top) * 1000) / 1000,
        )
        return [...new Set(all)]
      }
      const node = document.querySelector(
        `${scope} [data-frame-id="${frame.id}"]`,
      )
      const text = node?.querySelector('[data-testid="frame-text"]')
      if (node == null || text == null) {
        throw new Error(`text frame ${frame.id} not painted in ${scope}`)
      }
      const box = node.getBoundingClientRect()
      const mm = box.width / frame.rect.width
      const css = getComputedStyle(text)
      const probe = document.createElement('div')
      Object.assign(probe.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${String(frame.rect.width * mm)}px`,
        fontFamily: css.fontFamily,
        fontWeight: css.fontWeight,
        fontSize: `${String(frame.sizeMm * mm)}px`,
        lineHeight: String(frame.lineHeight),
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      })
      probe.textContent = text.textContent
      document.body.append(probe)
      const reference = tops(probe, probe.getBoundingClientRect())
      probe.remove()
      return { pxPerMm: mm, tops: tops(text, box), reference }
    },
    { scope, frame },
  )
}

/** Each line within half a screen px of its on-screen-size reference. */
function expectScreenSizeLines(lines: LineTops, label: string): void {
  expect(lines.tops).toHaveLength(lines.reference.length)
  lines.tops.forEach((top, i) => {
    const delta = Math.abs(top - (lines.reference[i] ?? Infinity))
    expect(delta, `${label} line ${String(i)}`).toBeLessThanOrEqual(0.5)
  })
}

test('text frames are transparent, and Preview sets lines at screen size like the canvas', async ({
  page,
}) => {
  // Designer's review viewport.
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
  const spreadId = await spreadView(page).getAttribute('data-spread-id')
  for (const { id, rect, styleId, text } of TEXT_FRAMES) {
    await dispatch(page, { type: 'addTextFrame', spreadId, rect, id })
    await dispatch(page, {
      type: 'setTextStyle',
      spreadId,
      frameId: id,
      styleId,
    })
    await dispatch(page, { type: 'editText', spreadId, frameId: id, text })
  }
  await page.evaluate(() => document.fonts.ready)
  const canvasScope = `[data-testid="spread-view"][data-spread-id="${spreadId ?? ''}"]`
  await expect(
    page.locator(`${canvasScope} [data-frame-id="e2e-body"]`).first(),
  ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  for (const frame of TEXT_FRAMES) {
    expectScreenSizeLines(
      await lineTops(page, canvasScope, frame),
      `canvas ${frame.id}`,
    )
  }

  await page.getByTestId('present').click()
  await expect(page.getByTestId('site-page-indicator')).toHaveText('Cover')
  await page.keyboard.press('ArrowRight')
  const slide = '[data-testid="site-spread"]'
  const previewFrame = page.locator(`${slide} [data-frame-id="e2e-body"]`)
  await expect(previewFrame).toBeVisible()
  await expect(previewFrame).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  // The spread paints at the site stage scale (px / mm = width / 2 trims).
  const fit = await page.locator(slide).evaluate((el) => {
    const spreadView = el.querySelector('[data-testid="spread-view"]')
    if (spreadView === null) {
      throw new Error('no spread in the active slide')
    }
    const s = el.getBoundingClientRect()
    const v = spreadView.getBoundingClientRect()
    return {
      side: el.getAttribute('data-side'),
      slide: { width: s.width, right: s.right },
      spread: { width: v.width, right: v.right },
    }
  })
  // Page 1 is a single right page: half the stage, on its right side.
  expect(fit.side).toBe('right')
  expect(Math.abs(fit.spread.width - fit.slide.width / 2)).toBeLessThan(1)
  expect(Math.abs(fit.spread.right - fit.slide.right)).toBeLessThan(1)

  // A scaled tree set text at ~0.5 px / mm and rounded each baseline there
  // (Body gaps 15 / 23 px); Preview now lays it out at its on-screen size.
  const preview = []
  for (const frame of TEXT_FRAMES) {
    const lines = await lineTops(page, slide, frame)
    expectScreenSizeLines(lines, `preview ${frame.id}`)
    preview.push(lines)
  }
  // Body: four lines, one every 5.40 mm (3.6 mm × 1.5).
  const body = preview[0] ?? { pxPerMm: 0, tops: [], reference: [] }
  expect(body.tops).toHaveLength(4)
  body.tops.slice(1).forEach((top, i) => {
    const pitch = top - (body.tops[i] ?? 0)
    expect(Math.abs(pitch - 5.4 * body.pxPerMm)).toBeLessThanOrEqual(0.5)
  })
})

test('an empty text frame shows Empty text in the editor only', async ({
  page,
}) => {
  await openSessionEditor(page)
  const spreadId = await spreadView(page).getAttribute('data-spread-id')
  await dispatch(page, {
    type: 'addTextFrame',
    spreadId,
    rect: TEXT_RECT,
    id: 'e2e-empty',
  })
  const text = textFrame(page).getByTestId('frame-text')
  await expect(text).toHaveText('Empty text')
  await expect(text).toHaveCSS('opacity', '0.4')
  await page.getByTestId('present').click()
  const stage = page.getByTestId('site-preview')
  await expect(stage).toBeVisible()
  await expect(stage.getByTestId('frame-text').first()).toHaveText('')
})
