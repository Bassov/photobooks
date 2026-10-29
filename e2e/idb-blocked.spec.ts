import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'

declare global {
  interface Window {
    __idbBlocked?: boolean
  }
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    window.__idbBlocked = false
  })
  await clearProjectSession(page)
})

test('blocked IndexedDB shows a storage error with retry and recovers', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await page.addInitScript(() => {
    window.__idbBlocked = true
    const realOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = (name: string, version?: number) => {
      if (!window.__idbBlocked) {
        return realOpen(name, version)
      }
      const request = {
        error: new DOMException('blocked', 'SecurityError'),
        onerror: null as (() => void) | null,
      }
      queueMicrotask(() => {
        request.onerror?.()
      })
      return request as unknown as IDBOpenDBRequest
    }
  })

  await page.goto('/')
  await expect(page.getByTestId('welcome-error')).toContainText(
    'Browser storage is unavailable',
    { timeout: 15_000 },
  )
  await expect(page.getByTestId('welcome-retry')).toBeEnabled()
  await expect(page.getByTestId('create-library')).toBeEnabled()
  await assertDocumentFitsViewport(page)

  await page.evaluate(() => {
    window.__idbBlocked = false
  })
  await page.getByTestId('welcome-retry').click()
  await expect(page.getByTestId('welcome-error')).toHaveCount(0)
  await expect(page.getByTestId('welcome-retry')).toHaveCount(0)
  await expect(page.getByTestId('create-library')).toBeVisible()
  expect(pageErrors).toEqual([])
})
