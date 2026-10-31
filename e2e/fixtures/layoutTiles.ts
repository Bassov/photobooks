import { expect, type Locator, type Page } from '@playwright/test'

/** Inspector Spread context (opens the right panel when closed). */
export async function openSpreadTab(page: Page): Promise<void> {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
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

/**
 * Add `count` spreads with the row shortcut (Ctrl+Enter, the kit "Add after";
 * the list has no Add spread button). Each lands after the first spread, whose
 * row stays mounted in the windowed list; waits for every add on the canvas.
 */
export async function addSpreads(page: Page, count: number): Promise<void> {
  const scroll = page.getByTestId('pasteboard-scroll')
  const first = page.getByTestId(/^spread-list-item-/).first()
  for (let i = 0; i < count; i += 1) {
    const before = Number(await scroll.getAttribute('data-spread-count'))
    await first.press('Control+Enter')
    await expect(scroll).toHaveAttribute(
      'data-spread-count',
      String(before + 1),
    )
  }
}
