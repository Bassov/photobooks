import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('Masters mode shows the kit switch and the default Master A with its note', async ({
  page,
}) => {
  await openSessionEditor(page)
  const rows = page.locator('[data-testid^="spread-list-item-"]')
  const before = await rows.count()
  expect(before).toBeGreaterThan(0)

  // Step 21: switch to Masters.
  await page.getByTestId('left-tab-masters').click()
  const panel = page.getByTestId('masters-panel')
  await expect(panel).toBeVisible()
  // default-master: a new book has its empty default "Master A" (P1, P2).
  const masters = page.getByRole('listbox', { name: 'Masters' })
  await expect(masters.getByRole('option')).toHaveText(['Master ADefault'])
  await expect(masters.getByRole('option')).toHaveAccessibleName(
    'Master A, default',
  )
  await expect(page.getByTestId('masters-empty')).toHaveCount(0)
  await expect(page.getByTestId('masters-canvas-empty')).toHaveCount(0)
  await expect(page.getByTestId('left-tab-masters')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  // Field track, bar-toned selected segment, rounded like the kit SegC.
  const track = page.getByRole('tablist', { name: 'Left panel' })
  await expect(track).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  await expect(page.getByTestId('left-tab-masters')).toHaveCSS(
    'background-color',
    'rgb(225, 225, 225)',
  )
  await expect(track).toHaveCSS('border-radius', '8px')
  // The note names the default above the list: 12 / 400 / 16.8 SUB, the
  // name 500 T, text at the row label x (list inset 12 + 8).
  const intro = page.getByTestId('masters-intro')
  await expect(intro).toHaveText(
    'Anything on a master repeats on its pages. Spreads use the default, Master A, unless they pick another.',
  )
  const introStyle = await intro.evaluate((el) => {
    const s = getComputedStyle(el)
    const b = getComputedStyle(el.querySelector('b') as Element)
    return [
      s.fontSize,
      s.fontWeight,
      s.lineHeight,
      s.color,
      b.fontWeight,
      b.color,
    ]
  })
  expect(introStyle).toEqual([
    '12px',
    '400',
    '16.8px',
    'rgb(83, 81, 82)',
    '500',
    'rgb(57, 55, 56)',
  ])
  const introBox = await intro.boundingBox()
  const listBox = await page.getByTestId('masters-list').boundingBox()
  expect((introBox?.x ?? 0) + 8 - (listBox?.x ?? 0)).toBeCloseTo(20, 0)
  const tag = page.getByTestId('master-default-tag')
  const tagBox = await tag.boundingBox()
  expect(Math.round(tagBox?.height ?? 0)).toBe(14)
  await expect(tag).toHaveCSS('font-size', '10px')
  await expect(tag).toHaveCSS('border-radius', '4px')
  await expect(page.getByRole('button', { name: 'New master' })).toBeEnabled()
  const newMaster = page.getByRole('button', { name: 'New master' })
  const action = await newMaster.boundingBox()
  expect(action?.height).toBe(32)
  await assertDocumentFitsViewport(page)

  // New master: Master B, picked, shown on the canvas, not the default.
  await newMaster.click()
  await expect(masters.getByRole('option')).toHaveText([
    'Master ADefault',
    'Master B',
  ])
  await expect(masters.getByRole('option').nth(1)).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByTestId('master-usage')).toHaveText('Not used yet')
  await expect(
    page.getByTestId('masters-canvas').getByTestId('spread-view'),
  ).toBeVisible()
  await assertDocumentFitsViewport(page)

  // Step 23: back to Pages restores the book spreads.
  await page.getByTestId('left-tab-pages').click()
  await expect(page.getByTestId('spreads-panel')).toBeVisible()
  await expect(rows).toHaveCount(before)
  await assertDocumentFitsViewport(page)
})
