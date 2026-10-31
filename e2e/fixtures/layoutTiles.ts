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

/**
 * Apply a `cols × rows` contact sheet from the Layout section fields. On the
 * single-page first spread, 2 × 2 is the old `4-grid` and 2 × 1 the old
 * `2-up` (same rects and frame ids); the picker lists only the kit layouts.
 */
export async function applyContactSheet(
  page: Page,
  cols: number,
  rows: number,
): Promise<void> {
  await openSpreadTab(page)
  const fields = [
    [page.getByTestId('layout-contact-cols'), cols],
    [page.getByTestId('layout-contact-rows'), rows],
  ] as const
  for (const [field, value] of fields) {
    await field.fill(String(value))
    await field.blur()
  }
  await page.getByTestId('layout-contact-apply').click()
  // The fields follow the spread's contact sheet once it is applied.
  for (const [field, value] of fields) {
    await expect(field).toHaveValue(String(value))
  }
  await expect(
    page.getByTestId('layout-tile').and(page.locator('[aria-pressed="true"]')),
  ).toHaveCount(0)
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
