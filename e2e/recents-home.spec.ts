import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'

/**
 * Former multi-recent home coverage. Product surface is welcome/library;
 * detailed scenarios live in `library-screens.spec.ts`.
 */
test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

test('welcome replaces recents home without page scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-screen')).toHaveCount(0)
  await expect(page.getByTestId('create-library')).toBeVisible()
  await assertDocumentFitsViewport(page)
})
