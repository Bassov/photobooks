import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

async function openRightPanel(page: Page): Promise<void> {
  const open = await page.getByTestId('panel-r').getAttribute('data-open')
  if (open !== 'true') {
    await page.getByTestId('toggle-r').click()
  }
}

async function setField(page: Page, name: string, value: string) {
  const input = page.getByTestId(`spread-grid-field-${name}`)
  await input.fill(value)
  await input.blur()
}

/** The field box carrying `data-source` around one spread grid input. */
function fieldBox(page: Page, name: string) {
  return page.getByTestId(`spread-grid-field-${name}`).locator('..')
}

test('Book settings hold no Layout grid section', async ({ page }) => {
  await openSessionEditor(page)
  await openRightPanel(page)
  await page.getByTestId('book-title').click()

  // Kit book settings (uikit/src/sandbox/v7.tsx:202-210) have no Layout grid section.
  await expect(page.getByTestId('book-settings')).toBeVisible()
  await expect(page.getByTestId('grid-section-book')).toHaveCount(0)

  // The overlay eye is covered on the spread (inspector-spread-book.spec.ts).
  await assertDocumentFitsViewport(page)
})

// Kit Grid section (uikit/src/sandbox/context-inspector.tsx SpreadGridSection):
// "Use book / Custom"; the fields show only in Custom, grey until overridden.
// A new book has no parent, so it reads "Use book".
test('Spread override reads source spread; Use book resets to the inherited grid', async ({
  page,
}) => {
  await openSessionEditor(page)
  await openRightPanel(page)
  await page
    .getByTestId('spread-view')
    .first()
    .click({ position: { x: 4, y: 4 } })

  const section = page.getByTestId('grid-section-spread')
  const inherit = section.getByRole('radio', { name: 'Use book' })
  const custom = section.getByRole('radio', { name: 'Custom' })
  const columns = fieldBox(page, 'columns')
  await expect(section).toBeVisible()
  await expect(inherit).toBeChecked()
  await expect(section.getByTestId('spread-grid-inherit')).toBeVisible()
  await expect(page.getByTestId('spread-grid-field-columns')).toHaveCount(0)

  await section.getByText('Custom', { exact: true }).click()
  await expect(custom).toBeChecked()
  await expect(columns).toHaveAttribute('data-source', 'book')
  await expect(section.getByTestId('spread-grid-hint')).toHaveText(
    'Grey values follow the book grid.',
  )

  await setField(page, 'columns', '4')
  await expect(columns).toHaveAttribute('data-source', 'spread')
  await expect(page.getByTestId('spread-grid-reset-columns')).toBeVisible()
  await expect(custom).toBeChecked()

  await section.getByText('Use book', { exact: true }).click()
  await expect(inherit).toBeChecked()
  await expect(section.getByTestId('spread-grid-inherit')).toContainText(
    '2 × 2',
  )
  await section.getByText('Custom', { exact: true }).click()
  await expect(columns).toHaveAttribute('data-source', 'book')
})
