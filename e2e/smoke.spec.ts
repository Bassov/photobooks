import { expect, test } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'

test('branded editor shell shows Photobooks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Photobooks')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  await assertDocumentFitsViewport(page)
})
