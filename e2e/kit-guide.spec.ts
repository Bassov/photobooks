import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit product walkthrough (product-walkthrough): the KitBar "Walkthrough" item
// is painted on the kit home and opens #/guide with its chapter list.

test.use({ viewport: { width: 1440, height: 900 } })

/** the topmost painted element at the box centre lies inside the locator's element */
async function paintedOnTop(page: Page, loc: Locator) {
  const b = await loc.boundingBox()
  expect(b).not.toBeNull()
  const { x, y, width, height } = b ?? { x: 0, y: 0, width: 0, height: 0 }
  const handle = await loc.elementHandle()
  return page.evaluate(
    ([el, cx, cy]) => {
      const top = document.elementFromPoint(cx, cy)
      return !!top && (el as Element).contains(top)
    },
    [handle, x + width / 2, y + height / 2] as const,
  )
}

test('kit home: Walkthrough nav item is painted and opens #/guide with its chapter list', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/uikit/#/')
  const nav = page.locator('[data-nav="guide"]')
  await expect(nav).toBeVisible()
  await expect(nav).toHaveText('Walkthrough')
  await expect(nav).toHaveAttribute('role', 'link')
  expect(await paintedOnTop(page, nav)).toBe(true)
  await expect(nav).not.toHaveAttribute('aria-current', 'page')

  await nav.click()
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(page.locator('[data-nav="guide"]')).toHaveAttribute(
    'aria-current',
    'page',
  )
  const toc = page.getByTestId('guide-toc')
  await expect(toc).toBeVisible()
  // 21 chapters + "All features"
  await expect(toc.getByRole('link')).toHaveCount(22)
  await expect(toc.getByRole('link').last()).toHaveText('All features')
  expect(await paintedOnTop(page, toc.getByRole('link').first())).toBe(true)
  await expect(page.locator('h1')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('Walkthrough nav item opens #/guide from the keyboard', async ({
  page,
}) => {
  await page.goto('/uikit/#/components')
  const nav = page.locator('[data-nav="guide"]')
  await nav.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(page.getByTestId('guide-toc')).toBeVisible()
})
