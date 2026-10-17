import { expect, test } from '@playwright/test'

test('burn-in canary is deterministic', async ({ page }) => {
  await page.setContent('<main><h1>Photobooks burn-in</h1></main>')
  await expect(
    page.getByRole('heading', { name: 'Photobooks burn-in' }),
  ).toBeVisible()
})
