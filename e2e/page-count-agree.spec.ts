import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'

// page-count-mismatch (Designer 2026-11-04, #464 review): the top bar and
// Book settings said "6 pages" for a book whose list shows pages 1–4. One
// count (page 1, two per inner spread, a single last page) feeds them all.

test.beforeEach(async ({ page }) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await createBookViaLibrary(page, 'Lake trip')
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

/** Label of the last Spreads-list row (the list is windowed: scroll to the end first). */
async function lastPageLabel(page: Page): Promise<string> {
  const list = page.getByTestId('spreads-list')
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const rows = list.locator('[role="option"][data-item]')
  return (await rows.last().locator('[data-label]').textContent()) ?? ''
}

/** The text is painted: a box > 0 and the topmost element at its centre. */
async function expectPainted(text: Locator): Promise<void> {
  const box = await text.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)
  expect(
    await text.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      )
      return hit !== null && el.contains(hit)
    }),
  ).toBe(true)
}

test('top bar, Book settings and the page list agree on 4 pages', async ({
  page,
}) => {
  const size = page.getByTestId('book-size')
  await expect(size).toContainText('· 4 pages')
  await expectPainted(size)

  const list = page.getByTestId('spreads-list')
  const labels = list.locator('[role="option"][data-item] [data-label]')
  await expect(labels).toHaveText(['1', '2–3', '4'])

  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  await expect(field).toHaveValue('4')
  await expectPainted(field)
})

test('each typed page count equals the last page in the list', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  for (const pages of ['20', '34', '120']) {
    await field.fill(pages)
    await field.press('Enter')
    await expect(field).toHaveValue(pages)
    await expect(page.getByTestId('book-size')).toContainText(
      `· ${pages} pages`,
    )
    await expect.poll(() => lastPageLabel(page)).toBe(pages)
  }
})
