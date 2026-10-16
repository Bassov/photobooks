import { expect, test } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('branded editor shell shows Photobooks', async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByText('Photobooks')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  await assertDocumentFitsViewport(page)
})
