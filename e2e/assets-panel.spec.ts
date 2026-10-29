import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Owner decision (2026-10-29): the filmstrip covers the asset pool, so the
// editor has no Assets surface. This spec guards that removal.
test('left panel has a Pages | Masters switcher and no Assets tab', async ({
  page,
}) => {
  await openSessionEditor(page)
  const tabs = page.getByRole('tablist', { name: 'Left panel' })
  await expect(tabs.getByRole('tab')).toHaveText(['Pages', 'Masters'])
  await expect(page.getByTestId('left-tab-pages')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Assets', { exact: true })).toHaveCount(0)

  await page.getByTestId('left-tab-masters').click()
  await expect(page.getByTestId('masters-stub')).toBeVisible()
  await expect(page.getByTestId('spreads-list')).toHaveCount(0)
  await expect(page.getByText('Assets', { exact: true })).toHaveCount(0)

  await page.getByTestId('left-tab-pages').click()
  await expect(page.getByTestId('spreads-list')).toBeVisible()
})
