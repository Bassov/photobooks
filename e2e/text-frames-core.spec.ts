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
  const stage = page.getByTestId('presentation')
  await expect(stage).toBeVisible()
  await expect(stage.getByTestId('frame-text').first()).toHaveText(TEXT)
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
  const stage = page.getByTestId('presentation')
  await expect(stage).toBeVisible()
  await expect(stage.getByTestId('frame-text').first()).toHaveText('')
})
