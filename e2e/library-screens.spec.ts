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
  const offCenter = await page.evaluate(() => {
    const r = document
      .querySelector('[data-testid="create-book-dialog"]')
      ?.getBoundingClientRect()
    return r
      ? [
          Math.abs(r.x + r.width / 2 - innerWidth / 2),
          Math.abs(r.y + r.height / 2 - innerHeight / 2),
        ]
      : [Infinity, Infinity]
  })
  expect(Math.max(...offCenter)).toBeLessThan(2)
  for (const btn of [
    page.getByRole('button', { name: 'Cancel' }),
    page.getByTestId('create-book'),
  ]) {
    await expect(btn).toBeInViewport({ ratio: 1 })
  }
  await expect(page.getByTestId('create-title')).toHaveCSS(
    'border-top-color',
    'rgb(215, 215, 215)',
  )
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

  const { bookId, bookCount } = await page.evaluate(async () => {
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
    const listed = await api.listLibraryBooks()
    if (!listed.ok || !listed.value) {
      throw new Error(listed.code ?? 'list')
    }
    return { bookId: created.value.id, bookCount: listed.value.length }
  })

  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-path')).toBeVisible()
  await expect(page.getByTestId('change-library')).toBeVisible()
  await expect(page.getByTestId('library-settings')).toBeVisible()
  await expect(page.getByTestId(`library-book-${bookId}`)).toBeVisible()

  await page.getByTestId('library-settings').click()
  await expect(page.getByTestId('settings')).toBeVisible()
  await expect(page.getByTestId('settings-book-count')).toHaveText(
    String(bookCount),
  )
  await expect(page.getByTestId('settings-scroll')).toHaveAttribute(
    'data-scrollport',
    'settings',
  )
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="settings-scroll"]')
    if (!(scroll instanceof HTMLElement)) {
      throw new Error('settings-scroll missing')
    }
    scroll.style.maxHeight = '120px'
  })
  await assertNamedScrollport(page, 'settings-scroll', { axis: 'vertical' })
  await assertDocumentFitsViewport(page)
  await page.getByTestId('settings-back').click()
  await expect(page.getByTestId('library-books')).toBeVisible()
  await expect(page.getByTestId('library-settings')).toBeVisible()
  await expect(page.getByTestId('settings')).toBeHidden()

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

test('library-with-books chrome visible at 1280x800', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  const bookId = await page.evaluate(async () => {
    const api = window.__photobooksProject as
      | {
          attachMemoryLibraryForTests: () => Promise<{
            ok: boolean
            code?: string
          }>
          createBookInLibrary: (title?: string) => Promise<{
            ok: boolean
            code?: string
            value?: { id: string }
          }>
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
    const created = await api.createBookInLibrary('Chrome Book')
    if (!created.ok || !created.value) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    return created.value.id
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('new-book')).toBeVisible()
  await expect(page.getByTestId('lib-search')).toBeVisible()
  await expect(page.getByTestId('lib-sort')).toBeVisible()
  await expect(page.getByTestId('library-settings')).toBeVisible()
  const createBg = await page
    .getByTestId('new-book')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(createBg).toMatch(/rgb\(\s*35,\s*34,\s*35\s*\)|#232223/i)
  const cover = page.getByTestId(`library-book-${bookId}`)
  await expect(cover).toBeVisible()
  await expect(cover.getByTestId('book-object-spine')).toBeVisible()
  await expect(cover.getByTestId('book-object-pages')).toBeVisible()
  await expect(cover.locator('em')).toHaveText('Chrome Book')
  await expect(page.getByTestId('book-meta').first()).toContainText('pages')
  await expect(page.getByTestId('book-meta').first()).toContainText('edited')
  await assertDocumentFitsViewport(page)
})

test('library grid sort by title reorders books', async ({ page }) => {
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
          createBookInLibrary: (title?: string) => Promise<{
            ok: boolean
            code?: string
            value?: { id: string }
          }>
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
    const zulu = await api.createBookInLibrary('Zulu Night')
    if (!zulu.ok || !zulu.value) {
      throw new Error(zulu.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    const alpha = await api.createBookInLibrary('Alpha Trip')
    if (!alpha.ok || !alpha.value) {
      throw new Error(alpha.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    return { z: zulu.value.id, a: alpha.value.id }
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId('lib-sort').click()
  await page.getByText('Title', { exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Sort books: Title' }),
  ).toBeVisible()
  const order = await page
    .locator('[data-testid^="library-book-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')))
  expect(order.indexOf(`library-book-${ids.a}`)).toBeLessThan(
    order.indexOf(`library-book-${ids.z}`),
  )
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

test('kit v0.10 welcome, empty library and change-folder confirm tokens', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  // Demo step 01: text-only ink primary on the tonal wash, no blue / teal.
  await expect(page.getByTestId('create-library')).toHaveCSS(
    'background-color',
    'rgb(35, 34, 35)',
  )
  await expect(page.getByTestId('create-library')).toHaveCSS(
    'border-radius',
    '999px',
  )
  await expect(page.getByTestId('welcome-mark')).toBeVisible()
  await assertDocumentFitsViewport(page)

  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('missing api')
    }
    await api.seedHomeRecentsForTests(0)
  })
  // Demo step 03: LibraryEmpty inside the #E1E1E1 bar + canvas shell.
  await expect(page.getByTestId('library-empty')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-bar')).toHaveCSS(
    'background-color',
    'rgb(225, 225, 225)',
  )
  await expect(page.getByTestId('example-book')).toBeVisible()
  await expect(page.getByTestId('new-book')).toHaveCSS(
    'background-color',
    'rgb(35, 34, 35)',
  )
  await assertDocumentFitsViewport(page)

  // Demo step 04: change confirms first and names the no-move guarantee.
  await page.getByTestId('change-library').hover()
  await expect(page.getByTestId('change-library')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  await page.getByTestId('change-library').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Change the library folder?')
  await expect(dialog).toContainText('nothing is moved or deleted')
  await expect(
    page.getByRole('button', { name: 'Choose folder…' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('library-empty')).toBeVisible()
})

test('kit v0.10 books grid: tile, menu, rename, sort, search, remove tokens', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  const bookId = await page.evaluate(async () => {
    const api = window.__photobooksProject as
      | {
          attachMemoryLibraryForTests: () => Promise<{
            ok: boolean
            code?: string
          }>
          createBookInLibrary: (title?: string) => Promise<{
            ok: boolean
            code?: string
            value?: { id: string }
          }>
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
    const created = await api.createBookInLibrary('Kit Book')
    if (!created.ok || !created.value) {
      throw new Error(created.code ?? 'create')
    }
    await api.leaveEditorForLibrary()
    return created.value.id
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  // Step 41: tile = BookObject cover; quiet search / sort on the #D7D7D7 field.
  const tile = page.getByTestId(`library-book-${bookId}`)
  await expect(tile.getByTestId('book-object')).toBeVisible()
  await expect(page.getByTestId('lib-search')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  await expect(page.getByTestId('lib-sort')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  await assertDocumentFitsViewport(page)

  // Step 42: book menu (Open · Rename · Duplicate · Remove…), icons muted.
  await page.getByTestId('book-card').filter({ has: tile }).hover()
  await page.getByTestId(`book-menu-${bookId}`).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Open',
    'Rename',
    'Duplicate',
    'Remove…',
  ])

  // Step 43: rename input sits on the field tone.
  await menu.getByRole('menuitem', { name: 'Rename' }).click()
  await expect(page.getByTestId('rename-input')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  await page.getByTestId('rename-input').press('Escape')

  // Step 45: sort menu.
  await page.getByTestId('lib-sort').click()
  await expect(page.getByTestId('lib-sort-menu')).toBeVisible()
  await page.keyboard.press('Escape')

  // Step 46: search with no results.
  await page.getByTestId('lib-search-input').fill('zzz')
  await expect(page.getByTestId('lib-no-results')).toContainText(
    'No books match “zzz”',
  )
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(tile).toBeVisible()

  // Step 47: remove confirms first.
  await page.getByTestId('book-card').filter({ has: tile }).hover()
  await page.getByTestId(`book-menu-${bookId}`).click()
  await page.getByRole('menuitem', { name: 'Remove…' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Remove “Kit Book”?')
  await expect(dialog).toContainText('Photos stay on disk')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('kit v0.10 create book: dialog, size menu, custom size tokens', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('missing api')
    }
    await api.seedHomeRecentsForTests(0)
  })
  await expect(page.getByTestId('library-empty')).toBeVisible({
    timeout: 15_000,
  })

  // Step 05: centered dialog, title on the field tone, Cancel + Create visible.
  await page.getByTestId('new-book').click()
  const dialog = page.getByTestId('create-book-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Create book')
  await expect(page.getByTestId('create-title')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeInViewport({
    ratio: 1,
  })
  await expect(page.getByTestId('create-book')).toBeInViewport({ ratio: 1 })
  await assertDocumentFitsViewport(page)

  // Step 06: size menu lists only supported presets plus Custom.
  const options = page.getByTestId('create-preset').getByRole('option')
  await expect(options.first()).toHaveText(/^A6 /)
  await expect(options.last()).toHaveText('Custom size…')
  await page.getByTestId('create-preset').selectOption('custom')

  // Step 07: custom size in cm, kit field look.
  const custom = page.getByTestId('create-custom')
  await expect(custom).toBeVisible()
  for (const id of ['create-custom-w', 'create-custom-h']) {
    await expect(page.getByTestId(id).locator('..')).toHaveCSS(
      'background-color',
      'rgb(215, 215, 215)',
    )
  }
  await expect(custom).toContainText('cm')
  await expect(page.getByTestId('create-orientation')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
})
