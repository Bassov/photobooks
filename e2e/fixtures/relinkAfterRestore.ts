import type { Page } from '@playwright/test'
import { expect } from './coverage'

/**
 * After library restore/open, durable assets without a live File open the
 * relink dialog and hatch placed frames. Dismiss the dialog and assert the
 * hatch so hydration tests do not wait forever for `spread-frame-image`.
 */
export async function expectMissingHatchAfterRestore(
  page: Page,
  placedCount: number,
): Promise<void> {
  await expect(page.getByTestId('relink-dialog')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('relink-skip').click()
  await expect(page.getByTestId('relink-dialog')).toHaveCount(0)
  await expect(page.getByTestId('missing-assets-pill')).toBeVisible()
  await expect(page.getByTestId('spread-frame-missing')).toHaveCount(
    placedCount,
    { timeout: 15_000 },
  )
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
}
