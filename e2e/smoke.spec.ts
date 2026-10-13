import { expect, test } from '@playwright/test'

test('branded shell shows Photobooks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Photobooks')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Local-first photobook editor' }),
  ).toBeVisible()
})
