import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { LibraryScreen } from './LibraryScreen'
import {
  attachMemoryLibraryForTests,
  createBookInLibrary,
  leaveEditorForLibrary,
  patchProjectSessionSnapshotForTests,
  resetProjectSessionForTests,
  setAccessPhaseForTests,
  setSurfaceForTests,
} from './projectSession'
import * as projectSession from './projectSession'
import * as promptBookTitleModule from './promptBookTitle'

describe('LibraryScreen', () => {
  beforeEach(() => {
    resetProjectSessionForTests()
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({ name: 'Lib' }),
    })
  })

  afterEach(() => {
    cleanup()
    resetProjectSessionForTests()
    vi.restoreAllMocks()
  })

  it('shows empty create affordance then lists a created book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    render(<LibraryScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('create-book')).toBeTruthy()
    })
    expect(screen.getByTestId('library-folder-name').textContent).toBe(
      'Memory Library',
    )

    const created = await createBookInLibrary('Trip')
    expect(created.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')

    await waitFor(() => {
      expect(screen.getByTestId('library-books')).toBeTruthy()
    })
    expect(screen.getByText('Trip')).toBeTruthy()
    expect(screen.getByTestId('change-library')).toBeTruthy()
    expect(screen.getByTestId('library-settings')).toBeTruthy()

    fireEvent.click(screen.getByTestId('library-settings'))
    expect(screen.getByTestId('settings-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-dialog')).toBeNull()
    })
  })

  it('change-library invokes changeLibraryFolder', async () => {
    const change = vi
      .spyOn(projectSession, 'changeLibraryFolder')
      .mockResolvedValue({ ok: true, value: undefined })
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('change-library')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('change-library'))
    await waitFor(() => {
      expect(change).toHaveBeenCalled()
    })
  })

  it('shows loading while restorePending', () => {
    setSurfaceForTests('library')
    patchProjectSessionSnapshotForTests({ restorePending: true })
    render(<LibraryScreen />)
    expect(screen.getByTestId('library-loading')).toBeTruthy()
    expect(screen.queryByTestId('create-book')).toBeNull()
  })

  it('falls back to Library folder name and shows re-grant', async () => {
    setSurfaceForTests('library')
    patchProjectSessionSnapshotForTests({ libraryLabel: null })
    setAccessPhaseForTests('permission-required')
    const regrant = vi
      .spyOn(projectSession, 'regrantLibrary')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<LibraryScreen />)
    expect(screen.getByTestId('allow-library-access').textContent).toMatch(
      /Allow access to Library/,
    )
    fireEvent.click(screen.getByTestId('allow-library-access'))
    await waitFor(() => {
      expect(regrant).toHaveBeenCalled()
    })
  })

  it('shows list failure and retries', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    const list = vi.spyOn(projectSession, 'listLibraryBooks')
    list
      .mockResolvedValueOnce({ ok: false, code: 'not-found' })
      .mockResolvedValueOnce({
        ok: true,
        value: [{ id: 'b1', title: 'Recovered' }],
      })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-retry')).toBeTruthy()
    })
    expect(screen.queryByTestId('library-books')).toBeNull()
    fireEvent.click(screen.getByTestId('library-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('library-book-b1')).toBeTruthy()
    })
  })

  it('retry keeps the error state when refresh fails again', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: false,
      code: 'not-found',
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-retry')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('library-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('library-retry')).toBeTruthy()
    })
    expect(screen.queryByTestId('library-books')).toBeNull()
  })

  it('ignores list results after unmount', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    let resolveList!: (value: {
      ok: true
      value: { id: string; title: string }[]
    }) => void
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    vi.spyOn(projectSession, 'listLibraryBooks').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve
        }),
    )
    const view = render(<LibraryScreen />)
    expect(screen.queryByTestId('library-retry')).toBeNull()
    view.unmount()
    expect(abortSpy).toHaveBeenCalled()
    resolveList({ ok: true, value: [{ id: 'late', title: 'Late' }] })
    await Promise.resolve()
  })

  it('shows empty state and New book label for non-empty libraries', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    const emptyView = render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-empty')).toBeTruthy()
    })
    expect(screen.getByTestId('create-book').textContent).toMatch(/Create book/)
    expect(screen.queryByTestId('settings-dialog')).toBeNull()
    emptyView.unmount()

    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [{ id: 'b1', title: 'One' }],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('new-book')).toBeTruthy()
    })
    expect(screen.getByTestId('new-book').textContent).toMatch(/New book/)
    expect(screen.queryByTestId('create-book')).toBeNull()
  })

  it('create-book prompts and opens the new book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    // Clear adopted book so the empty create affordance is shown.
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    vi.spyOn(promptBookTitleModule, 'promptBookTitle').mockReturnValue('New')
    const create = vi.spyOn(projectSession, 'createBookInLibrary')
    create.mockResolvedValue({
      ok: true,
      value: makeBook({ id: 'new-1', title: 'New', gallery: [] }),
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('create-book')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('create-book'))
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith('New')
    })
  })

  it('create-book cancel does not create', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    vi.spyOn(promptBookTitleModule, 'promptBookTitle').mockReturnValue(null)
    const create = vi.spyOn(projectSession, 'createBookInLibrary')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('create-book')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('create-book'))
    await waitFor(() => {
      expect(promptBookTitleModule.promptBookTitle).toHaveBeenCalled()
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('opens and renames a listed book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const created = await createBookInLibrary('Alpha')
    expect(created.ok).toBe(true)
    assertOk(created)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const list = vi.spyOn(projectSession, 'listLibraryBooks')
    const open = vi
      .spyOn(projectSession, 'openBookFromLibrary')
      .mockResolvedValue({ ok: true, value: created.value })
    const rename = vi
      .spyOn(projectSession, 'renameBookInLibrary')
      .mockResolvedValue({ ok: true, value: undefined })
    vi.spyOn(promptBookTitleModule, 'promptBookTitle').mockReturnValue('Beta')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`library-book-${created.value.id}`),
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId(`library-book-${created.value.id}`))
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(created.value.id)
    })
    const listCallsBeforeRename = list.mock.calls.length
    fireEvent.click(screen.getByTestId(`library-rename-${created.value.id}`))
    await waitFor(() => {
      expect(rename).toHaveBeenCalledWith(created.value.id, 'Beta')
    })
    await waitFor(() => {
      expect(list.mock.calls.length).toBeGreaterThan(listCallsBeforeRename)
    })
  })

  it('rename cancel and rename failure do not refresh', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const created = await createBookInLibrary('Alpha')
    expect(created.ok).toBe(true)
    assertOk(created)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const rename = vi.spyOn(projectSession, 'renameBookInLibrary')
    const list = vi.spyOn(projectSession, 'listLibraryBooks')
    vi.spyOn(promptBookTitleModule, 'promptBookTitle')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('Nope')
    rename.mockResolvedValue({ ok: false, code: 'not-found' })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(
        screen.getByTestId(`library-rename-${created.value.id}`),
      ).toBeTruthy()
    })
    const listCallsBefore = list.mock.calls.length
    fireEvent.click(screen.getByTestId(`library-rename-${created.value.id}`))
    await waitFor(() => {
      expect(promptBookTitleModule.promptBookTitle).toHaveBeenCalled()
    })
    expect(rename).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(`library-rename-${created.value.id}`))
    await waitFor(() => {
      expect(rename).toHaveBeenCalled()
    })
    expect(list.mock.calls.length).toBe(listCallsBefore)
  })

  it('disables primary actions while busy', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    patchProjectSessionSnapshotForTests({ actionBusy: true })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('change-library')).toBeTruthy()
    })
    const change = screen.getByTestId('change-library')
    expect(
      change.getAttribute('data-disabled') ??
        change.getAttribute('aria-disabled') ??
        change.getAttribute('disabled'),
    ).toBeTruthy()
    const newOrCreate =
      screen.queryByTestId('new-book') ?? screen.getByTestId('create-book')
    expect(
      newOrCreate.getAttribute('data-disabled') ??
        newOrCreate.getAttribute('aria-disabled') ??
        newOrCreate.getAttribute('disabled'),
    ).toBeTruthy()
  })
})

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false },
): asserts result is { ok: true; value: T } {
  expect(result.ok).toBe(true)
}
