import { expect, type Page } from '@playwright/test'

export type ZoomMenuEntry =
  'Fit spread' | 'Fit width' | '100%' | '150%' | '200%' | '400%' | '50%'

/** Pick an entry from the top-bar zoom menu. */
export async function chooseZoom(
  page: Page,
  entry: ZoomMenuEntry,
): Promise<void> {
  await page.getByTestId('zoom-menu').click()
  await page.getByRole('menuitem', { name: entry }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
}

/** Physical zoom percent ("13%"), independent of the "Fit" label. */
export async function readZoomPercent(page: Page): Promise<string> {
  const value = await page
    .getByTestId('zoom-label')
    .getAttribute('data-zoom-percent')
  return value ?? ''
}
