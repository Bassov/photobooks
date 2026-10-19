import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
  type SessionDirectoryHandle,
  type StorageResult,
} from '../project'
import { HomeScreen } from './HomeScreen'
import {
  attachLibraryForTests,
  configureProjectSession,
  createBookInLibrary,
  getProjectSessionSnapshot,
  holdExternalBookLockForTests,
  leaveEditorForHome,
  resetProjectSessionForTests,
  tryRestore,
} from './projectSession'

describe('HomeScreen merge-blocker a11y', () => {
  beforeEach(() => {
    resetProjectSessionForTests()
  })

  afterEach(() => {
    cleanup()
    resetProjectSessionForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('library list has no listbox role or aria-selected on buttons', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-aria',
      handle: { name: 'AriaLib' },
    })
    const created = await createBookInLibrary('Aria Album')
    expect(created.ok).toBe(true)
    assert(created.ok)
    await leaveEditorForHome()

    render(<HomeScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('home-recents')).toBeTruthy()
    })
    const list = screen.getByLabelText('Recent libraries')
    expect(list.getAttribute('role')).toBeNull()
    const recent = screen.getByTestId('home-recent-lib-aria')
    expect(recent.getAttribute('aria-selected')).toBeNull()
    await waitFor(() => {
      expect(recent.getAttribute('aria-current')).toBe('true')
    })
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('Aria Album')
    })
  })

  it('rename prompt updates the listed display title', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-ui',
      handle: { name: 'RenameUi' },
    })
    const created = await createBookInLibrary('Before')
    assert(created.ok)
    await leaveEditorForHome()

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'After'),
    )
    render(<HomeScreen />)

    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('Before')
    })
    fireEvent.click(screen.getByTestId(`home-rename-${created.value.id}`))
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('After')
    })

    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok)
    expect(loaded.value.title).toBe('After')
  })

  it('rename cancel leaves the listed title unchanged', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-cancel',
      handle: { name: 'RenameCancel' },
    })
    const created = await createBookInLibrary('Keep')
    assert(created.ok)
    await leaveEditorForHome()

    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    render(<HomeScreen />)

    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('Keep')
    })
    fireEvent.click(screen.getByTestId(`home-rename-${created.value.id}`))
    expect(
      screen.getByTestId(`home-book-${created.value.id}`).textContent,
    ).toBe('Keep')
  })

  it('rename while busy is a no-op', async () => {
    const storage = createMemoryLibraryStorage()
    const base = createMemorySessionState()
    let releaseRemove!: () => void
    const removeGate = new Promise<void>((resolve) => {
      releaseRemove = resolve
    })
    const session = {
      ...base,
      removeRecentLibrary: async (id: string) => {
        await removeGate
        return base.removeRecentLibrary(id)
      },
    }
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-busy',
      handle: { name: 'Busy' },
    })
    const created = await createBookInLibrary('BusyTitle')
    assert(created.ok)
    await leaveEditorForHome()

    const prompt = vi.fn(() => 'Ignored')
    vi.stubGlobal('prompt', prompt)
    render(<HomeScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('BusyTitle')
    })

    fireEvent.click(screen.getByTestId('home-remove-lib-rename-busy'))
    await waitFor(() => {
      expect(getProjectSessionSnapshot().actionBusy).toBe(true)
      const rename = screen.getByTestId(`home-rename-${created.value.id}`)
      assert(rename instanceof HTMLButtonElement)
      expect(rename.disabled).toBe(true)
    })
    fireEvent.click(screen.getByTestId(`home-rename-${created.value.id}`))
    expect(prompt).not.toHaveBeenCalled()
    releaseRemove()
    await waitFor(() => {
      expect(getProjectSessionSnapshot().actionBusy).toBe(false)
    })
  })

  it('rename that fails does not refresh the list', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-fail-ui',
      handle: { name: 'FailUi' },
    })
    const created = await createBookInLibrary('Stay')
    assert(created.ok)
    await leaveEditorForHome()

    await holdExternalBookLockForTests(created.value.id)

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Blocked'),
    )
    render(<HomeScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('Stay')
    })
    fireEvent.click(screen.getByTestId(`home-rename-${created.value.id}`))
    await waitFor(() => {
      expect(getProjectSessionSnapshot().homeError).toMatch(/another tab/i)
    })
    expect(
      screen.getByTestId(`home-book-${created.value.id}`).textContent,
    ).toBe('Stay')
  })

  it('clears books when refresh after rename fails', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    let blockList = false
    const listBooks = storage.listBooks.bind(storage)
    storage.listBooks = () => {
      if (blockList) {
        return Promise.resolve({ ok: false, code: 'not-found' })
      }
      return listBooks()
    }
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-refresh',
      handle: { name: 'Refresh' },
    })
    const created = await createBookInLibrary('Listed')
    assert(created.ok)
    await leaveEditorForHome()

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Renamed'),
    )
    render(<HomeScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('Listed')
    })
    blockList = true
    fireEvent.click(screen.getByTestId(`home-rename-${created.value.id}`))
    await waitFor(() => {
      expect(screen.queryByTestId(`home-book-${created.value.id}`)).toBeNull()
    })
    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok)
    expect(loaded.value.title).toBe('Renamed')
  })

  it('opens a book from the titled list', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-open-title',
      handle: { name: 'OpenTitle' },
    })
    const created = await createBookInLibrary('OpenMe')
    assert(created.ok)
    await leaveEditorForHome()

    render(<HomeScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`home-book-${created.value.id}`).textContent,
      ).toBe('OpenMe')
    })
    fireEvent.click(screen.getByTestId(`home-book-${created.value.id}`))
    await waitFor(() => {
      expect(getProjectSessionSnapshot().surface).toBe('editor')
      expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
    })
  })

  it('loading state renders no interactive buttons while restore is pending', async () => {
    const session = createMemorySessionState()
    let releaseRecall!: (value: StorageResult<SessionDirectoryHandle>) => void
    const recallGate = new Promise<StorageResult<SessionDirectoryHandle>>(
      (resolve) => {
        releaseRecall = resolve
      },
    )
    configureProjectSession({
      session: {
        ...session,
        recallLibraryHandle: () => recallGate,
        peekLibraryHandle: session.peekLibraryHandle.bind(session),
        removeRecentLibrary: session.removeRecentLibrary.bind(session),
        listRecentLibraries: session.listRecentLibraries.bind(session),
        rememberLibraryHandle: session.rememberLibraryHandle.bind(session),
        clearLibraryHandle: session.clearLibraryHandle.bind(session),
        setActiveIds: session.setActiveIds.bind(session),
        getActiveIds: session.getActiveIds.bind(session),
        acquireBookLock: session.acquireBookLock.bind(session),
      },
      storageKey: (() => {
        const map = new Map<string, string>([
          ['photobooks.libraryId', 'lib-load'],
          ['photobooks.activeBookId', 'book-load'],
        ])
        return {
          get length() {
            return map.size
          },
          clear() {
            map.clear()
          },
          getItem(key: string) {
            return map.get(key) ?? null
          },
          key(index: number) {
            return [...map.keys()][index] ?? null
          },
          removeItem(key: string) {
            map.delete(key)
          },
          setItem(key: string, value: string) {
            map.set(key, value)
          },
        }
      })(),
    })
    const restorePromise = tryRestore()
    render(<HomeScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('home-loading')).toBeTruthy()
    })
    expect(screen.queryByTestId('create-library')).toBeNull()
    expect(screen.queryByTestId('open-library')).toBeNull()
    expect(screen.queryByTestId('start-session')).toBeNull()
    releaseRecall({ ok: false, code: 'not-found' })
    await restorePromise
  })
})
