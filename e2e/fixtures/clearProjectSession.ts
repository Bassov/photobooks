import type { Page } from '@playwright/test'

/** Clear sessionStorage and the session-state IndexedDB so later tests start clean. */
export async function clearProjectSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    sessionStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('photobooks-session')
      request.onsuccess = () => {
        resolve()
      }
      request.onerror = () => {
        reject(request.error ?? new Error('indexedDB delete failed'))
      }
      request.onblocked = () => {
        resolve()
      }
    })
  })
}
