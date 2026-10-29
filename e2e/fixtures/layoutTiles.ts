import { expect, type Locator, type Page } from '@playwright/test'

/** Inspector Spread tab (opens the right panel when closed). */
export async function openSpreadTab(page: Page): Promise<void> {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await page.getByTestId('inspector-tab-spread').click()
  await expect(page.getByTestId('layout-section')).toBeVisible()
}

/** The inspector Layout tile for a template name (e.g. `4-grid`). */
export function layoutTile(page: Page, name: string): Locator {
  return page.getByRole('button', {
    name: `Apply layout ${name}`,
    exact: true,
  })
}

/**
 * Apply a template from the inspector Layout section. The right panel stays
 * open unless `restorePanel` puts it back as found (for specs that toggle it).
 */
export async function applyLayout(
  page: Page,
  name: string,
  { restorePanel = false }: { restorePanel?: boolean } = {},
): Promise<void> {
  const panel = page.getByTestId('panel-r')
  const wasOpen = (await panel.getAttribute('data-open')) === 'true'
  await openSpreadTab(page)
  const tile = layoutTile(page, name)
  await tile.click()
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
  if (restorePanel && !wasOpen) {
    await page.getByTestId('toggle-r').click()
    await expect(panel).toHaveAttribute('data-open', 'false')
  }
}

/** Add a spread after the last one (row "Add after", Ctrl+Enter; reveals it). */
export async function addSpreadAfterLast(page: Page): Promise<void> {
  const toggle = page.getByTestId('toggle-l')
  const reopen = (await toggle.getAttribute('aria-expanded')) !== 'true'
  if (reopen) {
    await toggle.click()
  }
  const rows = page.getByTestId(/^spread-list-item-/)
  const count = await rows.count()
  await rows.last().press('Control+Enter')
  await expect(rows).toHaveCount(count + 1)
  if (reopen) {
    await toggle.click()
  }
}
