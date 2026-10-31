import assert from 'node:assert/strict'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.beforeEach(async ({ page }) => {
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

async function box(
  page: import('@playwright/test').Page,
  testId: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await page.getByTestId(testId).boundingBox()
  if (found === null) {
    throw new Error(`no box for ${testId}`)
  }
  return found
}

// M5: uikit/src/sandbox/v7.tsx:67-71 (captions under the cover, back text bottom-left).
test('M5: cover captions sit under the cover and the back text is in the back panel', async ({
  page,
}) => {
  await page.getByTestId('cover-list-item').click()
  // Poll the whole comparison: the stage refits while the panels settle, so
  // two separate boxes can straddle a relayout.
  for (const name of ['back', 'spine', 'front']) {
    await expect
      .poll(async () => {
        const cover = await box(page, 'canvas-cover')
        const label = await box(page, `cover-label-${name}`)
        return label.y - (cover.y + cover.height)
      })
      .toBeGreaterThanOrEqual(8)
  }
  await page.getByTestId('cover-text-back').fill('Back words')
  const back = await box(page, 'cover-back')
  const text = await box(page, 'cover-back-text')
  await expect(page.getByTestId('cover-back-text')).toHaveText('Back words')
  expect(text.x).toBeLessThan(back.x + back.width / 2)
  expect(text.y).toBeGreaterThan(back.y + back.height / 2)
})

// M6: uikit/src/sandbox/v7.tsx:215-216 (Direction + Fill are Val pills).
test('M6: cover Direction and Back fill are read-only pills', async ({
  page,
}) => {
  await page.getByTestId('cover-list-item').click()
  const insp = page.getByTestId('insp-cover')
  await expect(insp.getByTestId('cover-direction')).toHaveText('Top to bottom')
  await expect(insp.getByTestId('cover-back-fill')).toHaveText('Paper white')
  await expect(insp.getByTestId('fill-readonly')).toHaveText('coming later')
  await expect(insp.getByRole('radio')).toHaveCount(0)
  await expect(insp.getByRole('button', { name: 'Navy' })).toHaveCount(0)
})

// M9: uikit/src/sandbox/viewport.tsx:110-121 (band [56, H-48], 40 px sides).
for (const kind of ['cover', 'endpaper'] as const) {
  test(`M9: ${kind} fits inside the 56/48 band with 40 px sides`, async ({
    page,
  }) => {
    await page
      .getByTestId(
        kind === 'cover' ? 'cover-list-item' : 'endpaper-list-item-front',
      )
      .click()
    const stage = await box(
      page,
      kind === 'cover' ? 'cover-stage' : 'endpaper-stage',
    )
    const spread = await box(
      page,
      kind === 'cover' ? 'canvas-cover' : 'canvas-endpaper',
    )
    expect(spread.y - stage.y).toBeGreaterThanOrEqual(55.5)
    expect(
      stage.y + stage.height - (spread.y + spread.height),
    ).toBeGreaterThanOrEqual(47.5)
    expect(spread.x - stage.x).toBeGreaterThanOrEqual(39.5)
    expect(
      stage.x + stage.width - (spread.x + spread.width),
    ).toBeGreaterThanOrEqual(39.5)
  })
}

// M10: uikit/src/sandbox/chrome.tsx:268-278 (rows stacked evenly incl. Endpaper).
test('M10: the last page row does not overlap the back Endpaper row', async ({
  page,
}) => {
  const list = page.getByTestId('spreads-list')
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const back = await box(page, 'endpaper-list-item-back')
  const rows = page.locator('[data-testid^="spread-list-item-"]')
  const last = await rows.last().boundingBox()
  assert(last !== null)
  expect(last.y + last.height).toBeLessThanOrEqual(back.y + 0.5)
})

// M12 / #17: uikit/src/sandbox/v7.tsx:195-210.
test('M12: book settings follow the kit fields', async ({ page }) => {
  await page.getByTestId('book-title').click()
  const panel = page.getByTestId('book-settings')
  await expect(panel.getByTestId('size-preset')).toBeVisible()
  await expect(
    panel.getByTestId('size-preset').locator('option').last(),
  ).toHaveText('Custom')
  await expect(panel.getByTestId('binding-style')).toHaveText('Hardcover')
  await expect(panel.getByTestId('binding-readonly')).toHaveText('read-only')
  // Kit v7.tsx:207-208: the note is computed from the spread count (6 pages).
  await expect(panel.getByTestId('book-pages-range')).toHaveText('20–120')
  await expect(panel.getByTestId('book-pages-note')).toHaveText(
    'Add 7 spreads to reach the 20-page minimum',
  )
  await expect(panel.getByTestId('book-bleed')).toContainText('mm')
  await expect(panel.getByTestId('book-safe-margin')).toContainText('mm')
  await expect(panel.getByText('Matte 200 g')).toBeVisible()
  await expect(panel.getByText('Default master')).toBeVisible()
  await expect(panel.getByTestId('page-colour-readonly')).toHaveText(
    'Paper white · coming later',
  )
  await expect(page.getByTestId('grid-section-book')).toHaveCount(0)
  await panel.getByTestId('size-preset').selectOption('A5')
  await expect(panel.getByTestId('size-w')).toHaveValue('14.8')
})

// M13: uikit/src/sandbox/v7.tsx:78-85,218-222.
test('M13: endpaper view has a caption, no inner label and a Pattern pill', async ({
  page,
}) => {
  await page.getByTestId('endpaper-list-item-front').click()
  const canvas = page.getByTestId('canvas-endpaper')
  await expect(canvas).not.toContainText('Pastedown')
  await expect(canvas.locator('.endpaper-caption')).toHaveText('Endpaper')
  const insp = page.getByTestId('insp-endpaper')
  await expect(insp.getByTestId('endpaper-style')).toHaveText('Pattern')
  await expect(insp.getByTestId('endp-fill-readonly')).toHaveText(
    'coming later',
  )
  await expect(insp.getByText(/Drag a photo/)).toHaveCount(0)
})
