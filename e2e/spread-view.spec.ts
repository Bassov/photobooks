import { expect, test } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'

test('painter fixture scrolls inside the workspace', async ({ page }) => {
  await page.goto('/?fixture=painter')

  await expect(page.getByTestId('spread-view')).toHaveCount(40)
  const placeholder = page.getByTestId('spread-frame-placeholder').first()
  await expect(placeholder).toBeVisible()
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(40)
  expect(box?.height ?? 0).toBeGreaterThan(40)
  await expect(page.getByTestId('spread-frame-image').first()).toBeVisible()

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'spread-fixture-scroll', {
    axis: 'vertical',
  })

  const filledMidScroll = await page
    .getByTestId('spread-fixture-scroll')
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2
      const port = el.getBoundingClientRect()
      const views = Array.from(
        el.querySelectorAll('[data-testid="spread-view"]'),
      )
      const slices = views
        .map((view) => {
          const rect = view.getBoundingClientRect()
          return {
            top: Math.max(rect.top, port.top),
            bottom: Math.min(rect.bottom, port.bottom),
          }
        })
        .filter((slice) => slice.bottom > slice.top)
        .sort((a, b) => a.top - b.top)
      let cursor = port.top
      let gap = 0
      for (const slice of slices) {
        if (slice.top > cursor) {
          gap += slice.top - cursor
        }
        cursor = Math.max(cursor, slice.bottom)
      }
      if (cursor < port.bottom) {
        gap += port.bottom - cursor
      }
      const moreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 1
      return gap < port.height * 0.25 && moreBelow
    })
  expect(filledMidScroll).toBe(true)
})

test('normal visit keeps the workspace placeholder', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(/Pasteboard workspace arrives/)).toBeVisible()
  await expect(page.getByTestId('spread-view')).toHaveCount(0)
  const placeholder = page.locator('.workspace-placeholder')
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(200)
  expect(box?.height ?? 0).toBeGreaterThan(20)
  await assertDocumentFitsViewport(page)
})
