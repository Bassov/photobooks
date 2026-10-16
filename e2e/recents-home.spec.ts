import { expect, test } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

test('empty home shows copy and library actions without page scroll', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-empty')).toBeVisible()
  await expect(page.getByTestId('create-library')).toBeVisible()
  await expect(page.getByTestId('open-library')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('fresh visit lists recent library books and one click opens', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const libraryFolder = `photobooks-e2e-recents-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  const prepared = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const attached = await api.attachOpfsTestLibrary(folderName)
    if (!attached.ok) {
      return { ok: false as const, reason: attached.code }
    }
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      return { ok: false as const, reason: created.code ?? 'create' }
    }
    api.saveBookNow()
    await new Promise<void>((resolve, reject) => {
      const started = Date.now()
      const tick = (): void => {
        const snap = api.getSnapshot() as {
          savePhase: string
          dirty: boolean
        }
        if (snap.savePhase === 'idle' && !snap.dirty) {
          resolve()
          return
        }
        if (Date.now() - started > 20_000) {
          reject(new Error('save timed out'))
          return
        }
        requestAnimationFrame(() => {
          tick()
        })
      }
      tick()
    })
    const snap = api.getSnapshot() as {
      libraryId: string | null
      bookId: string | null
    }
    return {
      ok: true as const,
      libraryId: snap.libraryId,
      bookId: snap.bookId,
    }
  }, libraryFolder)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) {
    throw new Error(prepared.reason)
  }

  await page.evaluate(() => {
    sessionStorage.clear()
  })
  await page.reload()

  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('home-recents')).toBeVisible()
  await expect(page.getByTestId('home-empty')).toHaveCount(0)

  const recentButton = page.locator('[data-testid^="home-recent-"]').first()
  await expect(recentButton).toBeVisible()
  await recentButton.click()

  const bookButton = page.locator(
    `[data-testid="home-book-${prepared.bookId ?? ''}"]`,
  )
  await expect(bookButton).toBeVisible({ timeout: 15_000 })
  await bookButton.click()

  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByTestId('save-book')).toBeEnabled()
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const snap = window.__photobooksProject?.getSnapshot() as
          { bookId: string | null } | undefined
        return snap?.bookId ?? null
      })
    })
    .toBe(prepared.bookId)

  await assertDocumentFitsViewport(page)
  await expect(page.getByTestId('pasteboard-scroll')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
})

test('Home button returns to home and reload stays on home', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const libraryFolder = `photobooks-e2e-home-btn-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('home-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.getByTestId('start-session').click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  const prepared = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const attached = await api.attachOpfsTestLibrary(folderName)
    if (!attached.ok) {
      return { ok: false as const, reason: attached.code }
    }
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      return { ok: false as const, reason: created.code ?? 'create' }
    }
    api.saveBookNow()
    await new Promise<void>((resolve, reject) => {
      const started = Date.now()
      const tick = (): void => {
        const snap = api.getSnapshot() as {
          savePhase: string
          dirty: boolean
        }
        if (snap.savePhase === 'idle' && !snap.dirty) {
          resolve()
          return
        }
        if (Date.now() - started > 20_000) {
          reject(new Error('save timed out'))
          return
        }
        requestAnimationFrame(() => {
          tick()
        })
      }
      tick()
    })
    return { ok: true as const, bookId: created.value.id }
  }, libraryFolder)
  expect(prepared.ok).toBe(true)

  await page.getByTestId('go-home').click()
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.reload()
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('editor-shell')).toHaveCount(0)
})

test('same-folder reopen does not duplicate recents', async ({ page }) => {
  test.setTimeout(90_000)
  const libraryFolder = `photobooks-e2e-dedup-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })

  const result = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api) {
      return { ok: false as const, reason: 'missing api' }
    }
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(folderName, { create: true })
    let seq = 0
    api.configureProjectSession({
      nowId: () => {
        seq += 1
        return `dedup-id-${String(seq)}`
      },
      pickDirectory: () => Promise.resolve(dir),
    })
    const first = await api.openLibrary()
    if (!first.ok) {
      return { ok: false as const, reason: first.code }
    }
    await api.leaveEditorForHome()
    const second = await api.openLibrary()
    if (!second.ok) {
      return { ok: false as const, reason: second.code }
    }
    await api.leaveEditorForHome()
    const listed = await api.listRecents()
    if (!listed.ok || !listed.value) {
      return { ok: false as const, reason: listed.code ?? 'list' }
    }
    return { ok: true as const, count: listed.value.length }
  }, libraryFolder)

  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.count).toBe(1)
  }
})

test('home overflow scrolls only inside the named home scrollport', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('home-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('seedHomeRecentsForTests missing')
    }
    await api.seedHomeRecentsForTests(40)
  })
  await expect(page.getByTestId('home-recents')).toBeVisible()
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="home-scroll"]')
    if (!(scroll instanceof HTMLElement)) {
      throw new Error('home-scroll missing')
    }
    scroll.style.maxHeight = '180px'
  })
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'home-scroll', {
    axis: 'vertical',
  })
})
