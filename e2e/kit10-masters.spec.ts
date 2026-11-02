import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('Masters mode shows the kit switch and a quiet empty note', async ({
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
  await expect(page.getByTestId('masters-empty')).toContainText(
    'No masters yet',
  )
  await expect(page.getByTestId('masters-canvas-empty')).toContainText(
    'No masters yet',
  )
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
  // A new book has no parents (parent-spreads), so no "Master A/B" text
  // anywhere and the inspector Master switch is hidden, not stubbed; the
  // real "New master" action sits under the list (kit chrome.tsx:321).
  await expect(page.getByText(/Master [AB]/)).toHaveCount(0)
  await expect(page.getByRole('radiogroup', { name: 'Master' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New master' })).toBeEnabled()
  await expect(page.getByTestId('masters-empty')).toHaveCSS(
    'border-top-width',
    '0px',
  )
  const newMaster = page.getByRole('button', { name: 'New master' })
  const note = await page.getByTestId('masters-empty').boundingBox()
  const action = await newMaster.boundingBox()
  expect(note?.width).toBeGreaterThan(150)
  expect(action?.height).toBe(32)
  await assertDocumentFitsViewport(page)

  // New master: one row, picked, shown on the canvas; the notes go away.
  await newMaster.click()
  await expect(
    page.getByRole('listbox', { name: 'Masters' }).getByRole('option'),
  ).toHaveText(['Master A'])
  await expect(page.getByTestId('masters-empty')).toHaveCount(0)
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
