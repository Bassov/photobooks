import { expect, type Page } from '@playwright/test'

/** Cold-start welcome, then enter the session editor without a library. */
export async function openSessionEditor(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    const api = window.__photobooksProject
    if (!api?.startSessionEditor) {
      throw new Error('startSessionEditor missing')
    }
    api.startSessionEditor()
  })
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  // Cold start leaves restorePending briefly; wait until chrome is interactive
  // so axe does not sample opacity-disabled buttons (~4.24:1).
  await expect(page.getByTestId('go-library')).toBeEnabled({ timeout: 15_000 })
}
