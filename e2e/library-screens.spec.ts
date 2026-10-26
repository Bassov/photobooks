import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

test('unsupported browser blocks when directory picker is missing', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: {
        brands: [{ brand: 'Firefox', version: '130' }],
        mobile: false,
      },
    })
  })
  await page.goto('/')
  await expect(page.getByTestId('unsupported-browser')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('unsupported-scroll')).toBeVisible()
  await expect(page.getByTestId('unsupported')).toHaveAttribute(
    'data-variant',
    'other',
  )
  await expect(page.getByTestId('get-chrome')).toBeVisible()
  await expect(page.getByTestId('get-chrome')).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  await expect(page.getByTestId('unsupported-title')).toBeVisible()
  await expect(page.getByTestId('browser-list')).toBeVisible()
  await expect(page.getByTestId('browser-link-Microsoft Edge')).toBeVisible()
  await page.getByTestId('copy-link').click()
  await expect(page.getByText('Link copied')).toBeVisible()
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0)
  await expect(page.getByTestId('library-screen')).toHaveCount(0)
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
  await expect(page.getByText(/continue anyway/i)).toHaveCount(0)
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="unsupported-scroll"]')
    if (!(scroll instanceof HTMLElement)) {
      throw new Error('unsupported-scroll missing')
    }
    scroll.style.maxHeight = '160px'
  })
  await assertNamedScrollport(page, 'unsupported-scroll', { axis: 'vertical' })
  await assertDocumentFitsViewport(page)
})

test('unsupported no-api shows reload when Chromium lacks the picker', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: {
        brands: [
          { brand: 'Chromium', version: '130' },
          { brand: 'Google Chrome', version: '130' },
        ],
        mobile: false,
      },
    })
  })
  await page.goto('/')
  await expect(page.getByTestId('unsupported-browser')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('unsupported')).toHaveAttribute(
    'data-variant',
    'no-api',
  )
  await expect(page.getByTestId('reload-after-enable')).toBeVisible()
  await expect(page.getByTestId('get-chrome')).toBeVisible()
  await expect(page.getByTestId('browser-list')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('welcome shows Create Library without page scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('create-library')).toBeVisible()
  await expect(page.getByTestId('screen-credit')).toBeVisible()
  await expect(page.getByTestId('welcome-hero')).toHaveAttribute(
    'data-hero-src',
    '/photos/hi/c18.jpg',
  )
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('Create Library cancel stays on Welcome', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException('User cancelled', 'AbortError')),
    })
  })
  await page.getByTestId('create-library').click()
  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByTestId('welcome-error')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-screen')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('Create Library success opens library via FSA stub', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('welcome-create-lib', {
      create: true,
    })
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve(dir),
    })
  })
  await page.getByTestId('create-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('empty library kit chrome and Create book dialog open editor', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('missing api')
    }
    // Empty memory library (attach would adopt the session book).
    await api.seedHomeRecentsForTests(0)
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-empty')).toBeVisible()
  await expect(page.getByTestId('example-book')).toBeVisible()
  await expect(page.getByTestId('screen-credit')).toBeVisible()
  await expect(page.getByText(/0 books/i)).toHaveCount(0)
  await page.getByTestId('new-book').click()
  await expect(page.getByTestId('create-book-dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('create-book-dialog')).toHaveCount(0)
  await expect(page.getByTestId('library-empty')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
  await page.getByTestId('new-book').click()
  await expect(page.getByTestId('create-book-dialog')).toBeVisible()
  await page.getByTestId('create-title').fill('Trip')
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await assertDocumentFitsViewport(page)
})

test('memory library opens library screen then editor and back', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })

  const bookId = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      throw new Error(created.code ?? 'create')
    }
    return created.value.id
  })

  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-path')).toBeVisible()
  await expect(page.getByTestId('change-library')).toBeVisible()
  await expect(page.getByTestId('library-settings')).toBeVisible()
  await expect(page.getByTestId(`library-book-${bookId}`)).toBeVisible()

  await page.getByTestId('library-settings').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByTestId('settings-close').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const opened = await page.evaluate(async (id) => {
    const api = window.__photobooksProject
    if (!api?.openBookFromLibrary) {
      throw new Error('openBookFromLibrary missing')
    }
    return api.openBookFromLibrary(id)
  }, bookId)
  expect(opened.ok).toBe(true)

  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  await assertDocumentFitsViewport(page)
})

test('change library updates folder name via FSA picker stub', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })

  const firstBookId = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    return created.value.id
  })

  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-path')).toHaveText('Memory Library')
  await expect(page.getByTestId(`library-book-${firstBookId}`)).toBeVisible()

  // Chromium FSA double: change-library uses showDirectoryPicker.
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () =>
        Promise.resolve({
          name: 'Second Library',
          kind: 'directory',
        } as FileSystemDirectoryHandle),
    })
  })

  await page.getByTestId('change-library').click()
  await page.getByRole('button', { name: 'Choose folder…' }).click()
  await expect(page.getByTestId('library-path')).toHaveText('Second Library', {
    timeout: 15_000,
  })
  // Same memory storage is rebound; books stay, folder label updates.
  await expect(page.getByTestId(`library-book-${firstBookId}`)).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test('library grid search filters by title', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  const ids = await page.evaluate(async () => {
    const api = window.__photobooksProject as
      | {
          attachMemoryLibraryForTests: () => Promise<{
            ok: boolean
            code?: string
          }>
          createBookInLibrary: (
            title?: string,
          ) => Promise<{ ok: boolean; code?: string; value?: { id: string } }>
          leaveEditorForLibrary: () => Promise<void>
        }
      | undefined
    if (!api) {
      throw new Error('missing api')
    }
    const attached = await api.attachMemoryLibraryForTests()
    if (!attached.ok) {
      throw new Error(attached.code ?? 'attach')
    }
    const first = await api.createBookInLibrary('Alpha Trip')
    if (!first.ok || !first.value) {
      throw new Error(first.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    const second = await api.createBookInLibrary('Zulu Night')
    if (!second.ok || !second.value) {
      throw new Error(second.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    return { a: first.value.id, z: second.value.id }
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId(`library-book-${ids.a}`)).toBeVisible()
  await expect(page.getByTestId(`library-book-${ids.z}`)).toBeVisible()
  await page.getByTestId('lib-search-input').fill('zulu')
  await expect(page.getByTestId(`library-book-${ids.z}`)).toBeVisible()
  await expect(page.getByTestId(`library-book-${ids.a}`)).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('library scrollport contains overflow when many books', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('seedHomeRecentsForTests missing')
    }
    await api.seedHomeRecentsForTests(40)
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-scroll')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="library-scroll"]')
    if (!(scroll instanceof HTMLElement)) {
      throw new Error('library-scroll missing')
    }
    scroll.style.maxHeight = '180px'
  })
  await assertNamedScrollport(page, 'library-scroll', { axis: 'vertical' })
  await assertDocumentFitsViewport(page)
})
