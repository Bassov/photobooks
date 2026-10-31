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
  await expect(page.getByTestId('masters-stub')).toContainText('No masters yet')
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
  // No master A / B entries, no stub controls, no card chrome. The only
  // "Master A/B" texts on the page are the spread inspector's kit Master &
  // spacing switch and Grid inherit line (context-inspector.tsx:222, 245).
  await expect(panel.getByText(/Master [AB]/)).toHaveCount(0)
  const inspectorMasters = page
    .getByTestId('inspector-panel')
    .getByText(/Master [AB]/)
  await expect(page.getByText(/Master [AB]/)).toHaveCount(
    await inspectorMasters.count(),
  )
  await expect(
    page.getByTestId('spread-master-spacing').getByText(/^Master [AB]$/),
  ).toHaveText(['Master A', 'Master B'])
  await expect(page.getByRole('button', { name: /New master/ })).toHaveCount(0)
  await expect(page.getByTestId('masters-stub')).toHaveCSS(
    'border-top-width',
    '0px',
  )
  await assertDocumentFitsViewport(page)

  // Step 23: back to Pages restores the book spreads.
  await page.getByTestId('left-tab-pages').click()
  await expect(page.getByTestId('spreads-panel')).toBeVisible()
  await expect(rows).toHaveCount(before)
  await assertDocumentFitsViewport(page)
})
