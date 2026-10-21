import { expect, type Page } from '@playwright/test'

/** Cold-start home, then enter the session editor without a library. */
export async function openSessionEditor(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('start-session')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  // Cold start leaves restorePending briefly; wait until chrome is interactive
  // so axe does not sample opacity-disabled buttons (~4.24:1).
  await expect(page.getByTestId('go-home')).toBeEnabled({ timeout: 15_000 })
}
