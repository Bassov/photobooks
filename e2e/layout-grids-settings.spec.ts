import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
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

test('Book → Layout grid: Columns updates the summary and the overlay', async ({
  page,
}) => {
  await openSessionEditor(page)
  await openRightPanel(page)
  await page
    .getByTestId('inspector-panel')
    .locator('.pb-segmented__segment', { hasText: 'Book' })
    .click()

  const section = page.getByTestId('grid-section-book')
  await expect(section.getByText('Layout grid')).toBeVisible()
  await expect(page.getByTestId('grid-summary')).toHaveText('2×2')

  await setField(page, 'columns', '6')
  await expect(page.getByTestId('grid-summary')).toHaveText('6×2')

  await expect(page.getByTestId('grid-overlay')).toHaveCount(0)
  await page.getByTestId('grid-toggle').click()
  await expect(page.getByTestId('grid-toggle')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('grid-overlay-column').first()).toBeAttached()
})

test('Spread override shows SPREAD and enables Reset to book grid', async ({
  page,
}) => {
  await openSessionEditor(page)
  await openRightPanel(page)
  await page
    .getByTestId('spread-view')
    .first()
    .click({ position: { x: 4, y: 4 } })

  const section = page.getByTestId('grid-section-spread')
  await expect(section).toBeVisible()
  await expect(page.getByTestId('grid-source-columns')).toHaveText('book')
  await expect(page.getByTestId('grid-reset')).toBeDisabled()

  await setField(page, 'columns', '4')
  await expect(page.getByTestId('grid-source-columns')).toHaveText('spread')
  await expect(page.getByTestId('grid-reset')).toBeEnabled()

  await page.getByTestId('grid-reset').click()
  await expect(page.getByTestId('grid-source-columns')).toHaveText('book')
  await expect(page.getByTestId('grid-reset')).toBeDisabled()
})
