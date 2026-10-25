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
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('/')
  await expect(page.getByTestId('unsupported-browser')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0)
  await expect(page.getByTestId('library-screen')).toHaveCount(0)
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('welcome shows Create Library without page scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('create-library')).toBeVisible()
  await expect(page.getByTestId('screen-credit')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
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
  await expect(page.getByTestId('library-folder-name')).toBeVisible()
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
  await expect(page.getByTestId('library-folder-name')).toHaveText(
    'Memory Library',
  )
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
  await expect(page.getByTestId('library-folder-name')).toHaveText(
    'Second Library',
    { timeout: 15_000 },
  )
  // Same memory storage is rebound; books stay, folder label updates.
  await expect(page.getByTestId(`library-book-${firstBookId}`)).toBeVisible()
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
