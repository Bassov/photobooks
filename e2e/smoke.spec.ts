import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('kit editor chrome mounts pasteboard and filmstrip', async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('editor-bar')).toBeVisible()
  await expect(page.getByTestId('go-library')).toBeVisible()
  await expect(page.getByTestId('panel-l')).toBeVisible()
  await expect(page.getByTestId('canvas')).toBeVisible()
  await expect(page.getByTestId('pasteboard')).toBeVisible()
  await expect(page.getByTestId('panel-b')).toBeVisible()
  await expect(page.getByTestId('dock')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  await expect(page.getByTestId('panel-r')).toHaveAttribute(
    'data-open',
    'false',
  )
  await page.getByTestId('toggle-r').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('inspector')).toBeVisible()
  await expect(page.getByTestId('editor-preview')).toBeDisabled()
  await expect(page.getByTestId('export')).toBeDisabled()
  await expect(page.getByTestId('editor-publish')).toBeDisabled()
  await expect(page.getByTestId('spreads-list')).toHaveAttribute(
    'data-scrollport',
    'spreads-list',
  )
  await assertDocumentFitsViewport(page)
})
