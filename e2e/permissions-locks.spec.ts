import { expect, test } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

test('empty shell has no re-grant control or lock banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId('regrant-library')).toHaveCount(0)
  await expect(page.getByTestId('book-lock-banner')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test('Grant access regrant restores the persisted book', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  const bookId = await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('window.__photobooksProject is not available')
    }
    await api.attachMemoryLibraryForTests()
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      throw new Error(`create failed: ${created.code ?? 'missing value'}`)
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
        if (Date.now() - started > 15_000) {
          reject(new Error('save timed out'))
          return
        }
        requestAnimationFrame(() => {
          tick()
        })
      }
      tick()
    })

    api.configureProjectSession({
      session: {
        rememberLibraryHandle: () =>
          Promise.resolve({ ok: true, value: undefined }),
        clearLibraryHandle: () =>
          Promise.resolve({ ok: true, value: undefined }),
        acquireBookLock: () =>
          Promise.resolve({
            ok: true,
            value: { release: () => Promise.resolve() },
          }),
        recallLibraryHandle: () =>
          Promise.resolve({ ok: false, code: 'permission-required' }),
      },
    })
    await api.tryRestore()
    return created.value.id
  })

  await expect(page.getByTestId('regrant-library')).toBeVisible()
  await page.getByTestId('regrant-library').focus()
  await expect(page.getByTestId('regrant-library')).toBeFocused()
  await assertDocumentFitsViewport(page)

  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('window.__photobooksProject is not available')
    }
    const result = await api.regrantLibraryWithHandleForTests({
      id: 'e2e-regrant-handle',
    })
    if (!result.ok) {
      throw new Error(`regrant failed: ${result.code ?? 'unknown'}`)
    }
  })

  await expect(page.getByTestId('regrant-library')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snap = window.__photobooksProject?.getSnapshot() as {
          bookId: string | null
          accessPhase: string
        }
        return snap
      }),
    )
    .toMatchObject({ bookId, accessPhase: 'idle' })
  await assertDocumentFitsViewport(page)
})

test('locked-elsewhere shows banner and blocks Save', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })

  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) {
      throw new Error('window.__photobooksProject is not available')
    }
    await api.attachMemoryLibraryForTests()
    const created = await api.createBookInLibrary()
    if (!created.ok || !created.value) {
      throw new Error(`create failed: ${created.code ?? 'missing value'}`)
    }
    const bookId = created.value.id
    const held = await api.holdExternalBookLockForTests(bookId)
    if (!held.ok) {
      throw new Error(`hold failed: ${held.code ?? 'unknown'}`)
    }
    const blocked = await api.tryActivateLibraryBookForTests(bookId)
    if (blocked.ok) {
      throw new Error('expected locked-elsewhere')
    }
  })

  await expect(page.getByTestId('book-lock-banner')).toHaveText(
    'This book is open in another tab',
  )
  await expect(page.getByTestId('save-book')).toBeDisabled()
  await expect(page.getByTestId('create-book')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Add photos' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add folder' })).toBeDisabled()
  await assertDocumentFitsViewport(page)
})
