import { cleanup, render, screen, waitFor } from '@testing-library/react'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
