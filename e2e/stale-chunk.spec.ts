import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { topAt } from './fixtures/paintProbe'

// QA-1 (prod QA 2026-11-25): after a redeploy an open tab asks for the old
// hashed SitePreview chunk and the SPA fallback answers with index.html as
// text/html. The import throws; the editor must survive it.
async function serveStaleSitePreview(page: Page): Promise<string[]> {
  const html = await (await page.request.get('/')).text()
  const hits: string[] = []
  await page.route(/\/assets\/SitePreview-[^/]*\.js$/, async (route) => {
    hits.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'text/html', body: html })
  })
  return hits
}

/** Main-frame loads after the first one (reloads and goto). */
function countReloads(page: Page): { readonly count: number } {
  const loads = { count: -1 }
  page.on('load', () => {
    loads.count += 1
  })
  return loads
}

async function expectEditorWithReloadError(page: Page): Promise<void> {
  await expect(page.locator('#root')).not.toBeEmpty()
  await expect(page.getByTestId('editor-shell')).toBeAttached()
  const error = page.getByTestId('site-preview-load-error')
  await expect(error).toBeVisible()
  await expect(error.getByRole('button', { name: 'Reload' })).toBeVisible()
  // Painted on top, not hidden under the editor chrome.
  expect((await topAt(error))[0]).toContain('site-preview-load-error')
  // The message reads in one or two lines, not crushed into a column.
  const message = await error.locator('p').boundingBox()
  expect(message?.width).toBeGreaterThan(300)
  expect(message?.height).toBeLessThan(60)
}

test('a stale Preview chunk without a library shows Reload and keeps the editor', async ({
  page,
}) => {
  const hits = await serveStaleSitePreview(page)
  const loads = countReloads(page)
  await openSessionEditor(page)
  expect(loads.count).toBe(0)

  await page.getByTestId('present').click()
  await expectEditorWithReloadError(page)
  expect(hits.length).toBeGreaterThan(0)
  // A session book cannot be saved first, so nothing reloads by itself.
  expect(loads.count).toBe(0)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('site-preview')).toHaveCount(0)
  await expect(page.getByTestId('editor-shell')).not.toHaveAttribute(
    'inert',
    '',
  )
  await expect(page.getByTestId('present')).toBeFocused()
})

test('a stale Preview chunk saves and reloads once, then offers Reload (no loop)', async ({
  page,
}) => {
  await serveStaleSitePreview(page)
  const loads = countReloads(page)
  await openLibraryBook(page)
  expect(loads.count).toBe(0)

  const reloaded = page.waitForEvent('load')
  await page.getByTestId('present').click()
  await reloaded
  expect(loads.count).toBe(1)

  // The chunk is still missing after the reload: the guard declines a
  // second automatic reload and the Reload error is shown instead.
  await openLibraryBook(page)
  const navigationsBefore = loads.count
  await page.getByTestId('present').click()
  // Reload shows only after the shared recovery declined, so no reload is
  // queued behind it; a second press reuses that decision.
  await expectEditorWithReloadError(page)
  await page.keyboard.press('Escape')
  await page.getByTestId('present').click()
  await expectEditorWithReloadError(page)
  expect(loads.count).toBe(navigationsBefore)
})
