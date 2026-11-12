import { expect, test } from './fixtures/coverage'

// personal-site GL core (Designer Spec site-stand-v2 G, D1): the closed book is drawn by one shared three.js renderer
// into a canvas over the host box; `?gl=0` keeps the CSS book and never loads three.

const isThree = (f: string) => /three\.module\.min\.js(\?|$)/.test(f)

test('?gl=0 keeps the CSS book and never loads three', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/full/personal-site?gl=0')
  await expect(
    page
      .locator('[data-testid="ss9-book"][data-kind="face"] .sd-b3')
      .locator('visible=true')
      .first(),
  ).toBeVisible()
  await expect(page.getByTestId('book3d-gl')).toHaveCount(0)
  const loaded = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name),
  )
  expect(loaded.some(isThree)).toBe(false)
})
