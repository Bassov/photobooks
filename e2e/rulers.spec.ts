import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('rulers are off by default; the Rulers toggle and Shift+R show / hide them', async ({
  page,
}) => {
  await openSessionEditor(page)
  const toggle = page.getByRole('button', { name: /^Rulers/ })
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)
  await expect(page.getByTestId('ruler-y')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await expect(page.getByTestId('ruler-y')).toBeVisible()
  await expect(page.getByTestId('ruler-corner')).toHaveText('mm')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const x = await page.getByTestId('ruler-x').boundingBox()
  expect(Math.round(x?.height ?? 0)).toBe(22)
  const y = await page.getByTestId('ruler-y').boundingBox()
  expect(Math.round(y?.width ?? 0)).toBe(22)

  await toggle.click()
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)

  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toHaveCount(0)
  await expect(page.getByTestId('ruler-y')).toHaveCount(0)
})

test('rulers stay put while the pasteboard scrolls; the page itself never scrolls', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toBeVisible()
  const scroll = page.getByTestId('pasteboard-scroll')
  await scroll.evaluate((el) => {
    el.scrollTop = 120
  })
  await expect(page.getByTestId('ruler-y')).toBeVisible()
  const pageScroll = await page.evaluate(() => ({
    x: document.scrollingElement?.scrollLeft ?? 0,
    y: document.scrollingElement?.scrollTop ?? 0,
  }))
  expect(pageScroll).toEqual({ x: 0, y: 0 })
})
