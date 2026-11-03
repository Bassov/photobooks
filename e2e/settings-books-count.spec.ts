import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'

type ProbeWindow = Window & {
  __bookCountSamples?: string[]
  __bookCountDone?: boolean
}

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

// Designer r17 parity: editor → Settings showed "Books 0" for ~250 ms before
// the listed "1". The count must be a dash or the listed number, never "0".
test('editor Settings never flashes a 0 book count', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  const bookCount = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary()
    if (!created.ok) {
      throw new Error(created.code ?? 'create')
    }
    const listed = await api.listLibraryBooks()
    if (!listed.ok || !listed.value) {
      throw new Error(listed.code ?? 'list')
    }
    return String(listed.value.length)
  })
  expect(bookCount).not.toBe('0')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  // Every committed text (MutationObserver) plus a 16 ms sample for 500 ms.
  await page.evaluate(() => {
    const samples: string[] = []
    ;(window as ProbeWindow).__bookCountSamples = samples
    const read = () => {
      const el = document.querySelector('[data-testid="settings-book-count"]')
      if (el) {
        samples.push(el.textContent)
      }
    }
    const observer = new MutationObserver(read)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    const timer = window.setInterval(read, 16)
    window.setTimeout(() => {
      window.clearInterval(timer)
      observer.disconnect()
      ;(window as ProbeWindow).__bookCountDone = true
    }, 500)
  })
  await page.getByTestId('editor-settings-open').click()
  await expect(page.getByTestId('editor-settings')).toBeVisible()
  await page.waitForFunction(() => (window as ProbeWindow).__bookCountDone)

  const samples = await page.evaluate(
    () => (window as ProbeWindow).__bookCountSamples ?? [],
  )
  expect(samples.length).toBeGreaterThan(10)
  expect(samples.filter((text) => text !== '—' && text !== bookCount)).toEqual(
    [],
  )
  expect(samples.at(-1)).toBe(bookCount)
  await expect(page.getByTestId('settings-book-count')).toHaveText(bookCount)
})
