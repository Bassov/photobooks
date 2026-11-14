import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// design-r20-kit-mod-arrows (Designer site-preview-mode M96, 2026-11-06): in
// the kit `#/demo` Preview, Alt+→ stepped Pages 2–3 → Pages 4–5. Spec §4:
// Alt / Ctrl / Meta + Arrow / Home / End must not step; plain keys still do.
// Since personal-site K2 the Preview is the reading room: its key guard hands
// the plain page keys to the room.

const demo = (page: Page) => page.getByTestId('demo')
const label = (page: Page) => page.getByTestId('site-label')

async function openPreview(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await page.getByTestId('demo-preview').click()
  await expect(page.getByTestId('site-preview')).toBeVisible()
}

test.describe('kit Preview modified page keys', () => {
  test('Alt / Ctrl / Meta + Arrow / Home / End keep Pages 2–3; plain → turns to Pages 4–5', async ({
    page,
  }) => {
    await openPreview(page)
    await expect(label(page)).toHaveText('Cover')
    await page.keyboard.press('ArrowRight')
    await expect(label(page)).toHaveText(/^Page 1 /)
    await page.keyboard.press('ArrowRight')
    await expect(label(page)).toHaveText(/^Pages 2–3 /)

    for (const mod of ['Alt', 'Control', 'Meta']) {
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
        await page.keyboard.press(`${mod}+${key}`)
        await expect(
          page.getByTestId('site-preview'),
          `${mod}+${key}`,
        ).toBeVisible()
        await expect(label(page), `${mod}+${key}`).toHaveText(/^Pages 2–3 /)
      }
    }

    await page.keyboard.press('ArrowRight')
    await expect(label(page)).toHaveText(/^Pages 4–5 /)
  })
})
