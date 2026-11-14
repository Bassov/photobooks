import { expect, test } from './fixtures/coverage'

// Kit library Settings (moved from uikit/scripts/qa.mjs v0.9.1, uikit-qa-split-3):
// #/demo Settings shows the live book count and draws no card border.

test.use({ viewport: { width: 1440, height: 900 } })

interface DemoApi {
  reset: () => void
  state: () => { path: string; books: unknown[] }
  go: (view: string) => void
}

test('v0.9.1 §8 Settings live book count + no card border', async ({
  page,
}) => {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = [
      {
        id: 's1',
        title: 'One',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    d.go('library')
  })
  await page.click('[data-testid="home-settings"]')
  await expect(page.locator('[data-testid="settings-book-count"]')).toHaveText(
    '1',
  )
  const cardBorder = await page
    .locator('[data-testid="library-settings"]')
    .evaluate((e) => getComputedStyle(e).borderTopWidth)
  expect(['0px', '']).toContain(cardBorder)
})
