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
  const input = page.getByTestId(`grid-field-${name}`).getByRole('textbox')
  await input.fill(value)
  await input.blur()
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

// Kit Grid section (uikit/src/sandbox/context-inspector.tsx:224-231): the
// "Use master / Custom" switch replaces the Reset to book grid button; the
// fields show only in Custom.
test('Spread override shows SPREAD; Use master resets to the inherited grid', async ({
  page,
}) => {
  await openSessionEditor(page)
  await openRightPanel(page)
  await page
    .getByTestId('spread-view')
    .first()
    .click({ position: { x: 4, y: 4 } })

  const section = page.getByTestId('grid-section-spread')
  const inherit = section.getByRole('radio', { name: 'Use master' })
  const custom = section.getByRole('radio', { name: 'Custom' })
  await expect(section).toBeVisible()
  await expect(inherit).toBeChecked()
  await expect(section.getByTestId('spread-grid-inherit')).toBeVisible()
  await expect(page.getByTestId('grid-source-columns')).toHaveCount(0)

  await section.getByText('Custom', { exact: true }).click()
  await expect(custom).toBeChecked()
  await expect(page.getByTestId('grid-source-columns')).toHaveText('book')

  await setField(page, 'columns', '4')
  await expect(page.getByTestId('grid-source-columns')).toHaveText('spread')
  await expect(custom).toBeChecked()

  await section.getByText('Use master', { exact: true }).click()
  await expect(inherit).toBeChecked()
  await expect(section.getByTestId('spread-grid-inherit')).toContainText(
    '2 × 2',
  )
  await section.getByText('Custom', { exact: true }).click()
  await expect(page.getByTestId('grid-source-columns')).toHaveText('book')
})
