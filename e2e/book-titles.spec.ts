import { expect, test } from './fixtures/coverage'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { clearProjectSession } from './fixtures/clearProjectSession'
import {
  browserAssertNoLoaf,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'
import { choosePhotoFolder } from './fixtures/photoDirectoryPicker'

/** Local widen: create/rename title APIs land in this change; shared fixture types lag. */
interface TitleProjectApi {
  createBookInLibrary: (title?: string) => Promise<{
    ok: boolean
    code?: string
    value?: { id: string; title?: string }
  }>
}

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

function writeBulkImportFixtures(count: number): string[] {
  const dir = join(tmpdir(), `photobooks-titles-bulk-${String(process.pid)}`)
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const paths: string[] = []
  for (let i = 0; i < count; i += 1) {
    const path = join(dir, `bulk-${String(i).padStart(3, '0')}.png`)
    writeFileSync(path, png)
    paths.push(path)
  }
  return paths
}

async function waitForSaveIdle(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const snap = window.__photobooksProject?.getSnapshot() as
        { savePhase: string; dirty: boolean } | undefined
      return snap?.savePhase === 'idle' && !snap.dirty
    },
    undefined,
    { timeout: 20_000 },
  )
}

test('create with title, rename, reload and home show titles not ids', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const libraryFolder = `photobooks-e2e-titles-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('welcome-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
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
      return { ok: false as const, reason: attached.code ?? 'attach' }
    }
    const created = await (
      api as unknown as TitleProjectApi
    ).createBookInLibrary('Summer')
    if (!created.ok || !created.value) {
      return { ok: false as const, reason: created.code ?? 'create' }
    }
    return {
      ok: true as const,
      bookId: created.value.id,
    }
  }, libraryFolder)
  expect(prepared.ok).toBe(true)
  assert.equal(prepared.ok, true)

  await expect(page.getByTestId('book-title')).toHaveText('Summer')

  page.once('dialog', (dialog) => {
    void dialog.accept('Trip')
  })
  await page.getByTestId('rename-book').click()
  await expect(page.getByTestId('book-title')).toHaveText('Trip')
  await waitForSaveIdle(page)

  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })

  const bookButton = page.getByTestId(`library-book-${prepared.bookId}`)
  await expect(bookButton).toContainText('Trip')
  await expect(bookButton).not.toContainText(prepared.bookId)

  await page.getByTestId(`book-menu-${prepared.bookId}`).click()
  await page.getByTestId(`library-rename-${prepared.bookId}`).click()
  const renameInput = page.getByTestId('rename-input')
  await renameInput.fill('HomeRename')
  await renameInput.press('Enter')
  await expect(bookButton).toContainText('HomeRename')
  await assertDocumentFitsViewport(page)

  await page.evaluate(() => {
    sessionStorage.clear()
  })
  await page.reload()
  await expect(page.getByTestId('welcome-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId('library-screen')).toBeVisible()
  await expect(bookButton).toContainText('HomeRename', { timeout: 15_000 })
  await bookButton.click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByTestId('book-title')).toHaveText('HomeRename')
})

test('empty title shows Untitled book on home and chrome', async ({ page }) => {
  test.setTimeout(90_000)
  const libraryFolder = `photobooks-e2e-untitled-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('welcome-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('editor-shell')).toBeVisible()

  const prepared = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const attached = await api.attachOpfsTestLibrary(folderName)
    if (!attached.ok) {
      return { ok: false as const, reason: attached.code ?? 'attach' }
    }
    const created = await (
      api as unknown as TitleProjectApi
    ).createBookInLibrary('')
    if (!created.ok || !created.value) {
      return { ok: false as const, reason: created.code ?? 'create' }
    }
    return {
      ok: true as const,
      bookId: created.value.id,
      storedTitle: created.value.title ?? null,
    }
  }, libraryFolder)
  expect(prepared.ok).toBe(true)
  assert.equal(prepared.ok, true)
  expect(prepared.storedTitle).toBe('')

  await expect(page.getByTestId('book-title')).toHaveText('Untitled book')
  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible()
  await expect(
    page.getByTestId(`library-book-${prepared.bookId}`),
  ).toContainText('Untitled book')
  await assertDocumentFitsViewport(page)
})

test('cancelled create and rename leave titles unchanged', async ({ page }) => {
  test.setTimeout(90_000)
  const libraryFolder = `photobooks-e2e-title-cancel-${String(process.pid)}-${String(Date.now())}`

  await page.goto('/')
  await expect(page.getByTestId('welcome-loading')).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('editor-shell')).toBeVisible()

  const prepared = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api?.attachOpfsTestLibrary) {
      return { ok: false as const, reason: 'missing api' }
    }
    const attached = await api.attachOpfsTestLibrary(folderName)
    if (!attached.ok) {
      return { ok: false as const, reason: attached.code ?? 'attach' }
    }
    const created = await (
      api as unknown as TitleProjectApi
    ).createBookInLibrary('KeepMe')
    if (!created.ok || !created.value) {
      return { ok: false as const, reason: created.code ?? 'create' }
    }
    return { ok: true as const, bookId: created.value.id }
  }, libraryFolder)
  expect(prepared.ok).toBe(true)
  assert.equal(prepared.ok, true)
  await expect(page.getByTestId('book-title')).toHaveText('KeepMe')

  page.once('dialog', (dialog) => {
    void dialog.dismiss()
  })
  await page.getByTestId('rename-book').click()
  await expect(page.getByTestId('book-title')).toHaveText('KeepMe')

  page.once('dialog', (dialog) => {
    void dialog.dismiss()
  })
  await page.getByTestId('create-book').click()
  await expect(page.getByTestId('book-title')).toHaveText('KeepMe')
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const snap = window.__photobooksProject?.getSnapshot() as
          { bookId: string | null } | undefined
        return snap?.bookId ?? null
      })
    })
    .toBe(prepared.bookId)
})

test.describe('frame-budget gates', () => {
  test('rename while filmstrip scrolls stays within frame-budget gates', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const libraryFolder = `photobooks-e2e-title-loaf-${String(process.pid)}-${String(Date.now())}`
    await enablePerfScenario(page, '/?perf=1')
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
        return { ok: false as const, reason: attached.code ?? 'attach' }
      }
      const created = await (
        api as unknown as TitleProjectApi
      ).createBookInLibrary('Perf title')
      if (!created.ok || !created.value) {
        return { ok: false as const, reason: created.code ?? 'create' }
      }
      return { ok: true as const }
    }, libraryFolder)
    expect(prepared.ok).toBe(true)
    assert.equal(prepared.ok, true)
    await expect(page.getByTestId('book-title')).toHaveText('Perf title')
    await expect(page.getByTestId('rename-book')).toBeEnabled()

    const files = writeBulkImportFixtures(40)
    await choosePhotoFolder(page, files)
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 120_000 },
      )
      .toBe('40')

    await clearPerfScenario(page)

    // Measure rename (document string update + chrome) during scroll without the
    // window.prompt dialog, which is outside the title-edit cost model.
    const bookId = await page.evaluate(() => {
      const snap = window.__photobooksProject?.getSnapshot() as
        { bookId: string | null } | undefined
      return snap?.bookId ?? null
    })
    assert.ok(bookId)

    // Prime scroll so virtualizer is warm; LoAF window starts after clear.
    for (let i = 0; i < 5; i += 1) {
      await page.getByTestId('filmstrip-scroll').evaluate((node) => {
        node.scrollLeft += 120
      })
      await page.waitForTimeout(32)
    }
    await page.evaluate(() => {
      window.__photobooksPerf?.clearLoafEntries()
    })

    const scrollPromise = (async () => {
      for (let i = 0; i < 20; i += 1) {
        await page.getByTestId('filmstrip-scroll').evaluate((node) => {
          node.scrollLeft += 120
        })
        await page.waitForTimeout(32)
      }
    })()

    await page.evaluate(async (id) => {
      const project = window.__photobooksProject
      if (project === undefined) {
        throw new Error('__photobooksProject missing')
      }
      const api = project as unknown as {
        renameBookInLibrary: (
          bookId: string,
          title: string,
        ) => Promise<{ ok: boolean; code?: string }>
      }
      const renamed = await api.renameBookInLibrary(id, 'Renamed during scroll')
      if (!renamed.ok) {
        throw new Error(renamed.code ?? 'rename failed')
      }
    }, bookId)
    await expect(page.getByTestId('book-title')).toHaveText(
      'Renamed during scroll',
    )
    // Assert the rename-during-scroll window before post-scroll settle work.
    await page.evaluate(browserAssertNoLoaf, 0)
    await scrollPromise
    await assertDocumentFitsViewport(page)
  })
})
