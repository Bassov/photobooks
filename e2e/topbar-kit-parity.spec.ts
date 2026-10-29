import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { chooseZoom } from './fixtures/zoomMenu'

test('zoom menu picks 200% then Fit spread; camera strip is gone', async ({
  page,
}) => {
  await openSessionEditor(page)
  const label = page.getByTestId('zoom-label')
  await expect(page.getByTestId('camera-bar')).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Camera' })).toHaveCount(0)

  await chooseZoom(page, '200%')
  await expect(label).toHaveText('200%')

  await chooseZoom(page, 'Fit spread')
  await expect(label).toHaveText('Fit')
})

test('zoom menu shows the Ctrl+0 hint on Fit spread', async ({ page }) => {
  await openSessionEditor(page)
  await page.getByTestId('zoom-menu').click()
  await expect(
    page.getByRole('menuitem', { name: 'Fit spread Ctrl+0' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('Preview pill enters presentation', async ({ page }) => {
  await openSessionEditor(page)
  const pill = page.getByTestId('present')
  await expect(pill).toHaveText('Preview')
  await expect(pill).toBeEnabled()
  await pill.click()
  await expect(page.getByTestId('presentation')).toBeVisible()
})
