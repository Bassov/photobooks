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
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    // Attach adopts the session book; force empty for empty-chrome assertions.
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    render(<LibraryScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('library-empty')).toBeTruthy()
    })
    expect(screen.getByTestId('example-book')).toBeTruthy()
    expect(screen.getByTestId('screen-credit')).toBeTruthy()
    expect(screen.getByTestId('new-book').textContent).toMatch(/Create book/)
    expect(screen.getByTestId('library-path').textContent).toBe(
      'Memory Library',
    )

    vi.mocked(projectSession.listLibraryBooks).mockRestore()
    const created = await createBookInLibrary('Trip')
    expect(created.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')

    await waitFor(() => {
      expect(screen.getByTestId('library-books')).toBeTruthy()
    })
    expect(screen.getAllByText('Trip').length).toBeGreaterThan(0)
    expect(screen.getByTestId('change-library')).toBeTruthy()
    expect(screen.getByTestId('library-settings')).toBeTruthy()

    fireEvent.click(screen.getByTestId('library-settings'))
    expect(screen.getByTestId('settings-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-dialog')).toBeNull()
    })
  })

  it('change-library confirms then invokes changeLibraryFolder', async () => {
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
    expect(change).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder…' }))
    await waitFor(() => {
      expect(change).toHaveBeenCalled()
    })
  })

  it('shows loading while restorePending', () => {
    setSurfaceForTests('library')
    patchProjectSessionSnapshotForTests({ restorePending: true })
    render(<LibraryScreen />)
    expect(screen.getByTestId('library-loading')).toBeTruthy()
    expect(screen.queryByTestId('new-book')).toBeNull()
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

  it('shows empty kit chrome and Create book for non-empty libraries', async () => {
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
    expect(screen.getByTestId('new-book').textContent).toMatch(/Create book/)
    expect(screen.queryByText(/0 books/i)).toBeNull()
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
    expect(screen.getByTestId('new-book').textContent).toMatch(/Create book/)
  })

  it('create dialog confirms and opens the new book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    const create = vi.spyOn(projectSession, 'createBookInLibrary')
    create.mockResolvedValue({
      ok: true,
      value: makeBook({
        id: 'new-1',
        title: 'New',
        gallery: [],
        settings: {
          bleedMm: 3,
          safeMarginMm: 5,
          trim: { widthMm: 148, heightMm: 210 },
        },
      }),
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('new-book')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('new-book'))
    await waitFor(() => {
      expect(screen.getByTestId('create-book-dialog')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('create-title'), {
      target: { value: 'New' },
    })
    fireEvent.click(screen.getByTestId('create-book'))
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith('New', {
        trim: { widthMm: 148, heightMm: 210 },
      })
    })
  })

  it('create dialog cancel does not create', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    const create = vi.spyOn(projectSession, 'createBookInLibrary')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('new-book')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('new-book'))
    await waitFor(() => {
      expect(screen.getByTestId('create-book-dialog')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByTestId('create-book-dialog')).toBeNull()
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
    expect(open).toHaveBeenCalledTimes(1)
    const listCallsBeforeRename = list.mock.calls.length
    fireEvent.click(screen.getByTestId(`book-menu-${created.value.id}`))
    fireEvent.click(
      await screen.findByTestId(`library-rename-${created.value.id}`),
    )
    expect(open).toHaveBeenCalledTimes(1)
    const input = await screen.findByTestId('rename-input')
    fireEvent.change(input, { target: { value: 'Beta' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(rename).toHaveBeenCalledWith(created.value.id, 'Beta')
    })
    await waitFor(() => {
      expect(list.mock.calls.length).toBeGreaterThan(listCallsBeforeRename)
    })
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('rename escape and rename failure do not refresh', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const created = await createBookInLibrary('Alpha')
    expect(created.ok).toBe(true)
    assertOk(created)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const rename = vi.spyOn(projectSession, 'renameBookInLibrary')
    const list = vi.spyOn(projectSession, 'listLibraryBooks')
    rename.mockResolvedValue({ ok: false, code: 'not-found' })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId(`book-menu-${created.value.id}`)).toBeTruthy()
    })
    const listCallsBefore = list.mock.calls.length
    fireEvent.click(screen.getByTestId(`book-menu-${created.value.id}`))
    fireEvent.click(
      await screen.findByTestId(`library-rename-${created.value.id}`),
    )
    const cancelInput = await screen.findByTestId('rename-input')
    fireEvent.keyDown(cancelInput, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('rename-input')).toBeNull()
    })
    expect(rename).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId(`book-menu-${created.value.id}`))
    fireEvent.click(
      await screen.findByTestId(`library-rename-${created.value.id}`),
    )
    const failInput = await screen.findByTestId('rename-input')
    fireEvent.change(failInput, { target: { value: 'Nope' } })
    fireEvent.keyDown(failInput, { key: 'Enter' })
    await waitFor(() => {
      expect(rename).toHaveBeenCalled()
    })
    expect(list.mock.calls.length).toBe(listCallsBefore)
  })

  it('filters books by search title', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [
        { id: 'b1', title: 'Alpha', spreadCount: 2 },
        { id: 'b2', title: 'Zulu', spreadCount: 1 },
      ],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('lib-search-input')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('lib-search-input'), {
      target: { value: 'zul' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('library-book-b2')).toBeTruthy()
      expect(screen.queryByTestId('library-book-b1')).toBeNull()
    })
    fireEvent.change(screen.getByTestId('lib-search-input'), {
      target: { value: 'nope' },
    })
    await waitFor(() => {
      expect(screen.getByTestId('lib-no-results')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => {
      expect(screen.getByTestId('library-book-b1')).toBeTruthy()
      expect(screen.getByTestId('library-book-b2')).toBeTruthy()
    })
  })

  it('duplicates and removes a book from the card menu', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const list = vi
      .spyOn(projectSession, 'listLibraryBooks')
      .mockResolvedValue({
        ok: true,
        value: [{ id: 'b1', title: 'Keep', spreadCount: 2 }],
      })
    const dup = vi
      .spyOn(projectSession, 'duplicateBookInLibrary')
      .mockResolvedValue({
        ok: true,
        value: makeBook({ id: 'b1-copy', title: 'Keep (copy)' }),
      })
    const del = vi
      .spyOn(projectSession, 'deleteBookInLibrary')
      .mockResolvedValue({ ok: true, value: undefined })
    const open = vi
      .spyOn(projectSession, 'openBookFromLibrary')
      .mockResolvedValue({
        ok: true,
        value: makeBook({ id: 'b1', title: 'Keep' }),
      })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('book-menu-b1')).toBeTruthy()
    })
    const listAfterMount = list.mock.calls.length

    fireEvent.click(screen.getByTestId('book-menu-b1'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Open' }))
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith('b1')
    })

    fireEvent.click(screen.getByTestId('book-menu-b1'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    await waitFor(() => {
      expect(dup).toHaveBeenCalledWith('b1')
      expect(list.mock.calls.length).toBeGreaterThan(listAfterMount)
    })
    const afterDup = list.mock.calls.length

    fireEvent.click(screen.getByTestId('book-menu-b1'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Remove/ }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove book' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(del).not.toHaveBeenCalled()
    expect(list.mock.calls.length).toBe(afterDup)

    fireEvent.click(screen.getByTestId('book-menu-b1'))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Remove/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove book' }))
    await waitFor(() => {
      expect(del).toHaveBeenCalledWith('b1')
      expect(list.mock.calls.length).toBeGreaterThan(afterDup)
    })
  })

  it('skips rename persistence when the title is unchanged', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const created = await createBookInLibrary('Alpha')
    expect(created.ok).toBe(true)
    assertOk(created)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const rename = vi.spyOn(projectSession, 'renameBookInLibrary')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId(`book-menu-${created.value.id}`)).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId(`book-menu-${created.value.id}`))
    fireEvent.click(
      await screen.findByTestId(`library-rename-${created.value.id}`),
    )
    const input = await screen.findByTestId('rename-input')
    fireEvent.change(input, { target: { value: 'Alpha' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.queryByTestId('rename-input')).toBeNull()
    })
    expect(rename).not.toHaveBeenCalled()
  })

  it('commits rename on blur', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const created = await createBookInLibrary('Alpha')
    expect(created.ok).toBe(true)
    assertOk(created)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const rename = vi
      .spyOn(projectSession, 'renameBookInLibrary')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId(`book-menu-${created.value.id}`)).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId(`book-menu-${created.value.id}`))
    fireEvent.click(
      await screen.findByTestId(`library-rename-${created.value.id}`),
    )
    const input = await screen.findByTestId('rename-input')
    fireEvent.change(input, { target: { value: 'Blurred' } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(rename).toHaveBeenCalledWith(created.value.id, 'Blurred')
    })
  })

  it('does not open a book while busy', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    patchProjectSessionSnapshotForTests({ actionBusy: true })
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [{ id: 'b1', title: 'Busy', spreadCount: 1 }],
    })
    const open = vi.spyOn(projectSession, 'openBookFromLibrary')
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-book-b1')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('library-book-b1'))
    expect(open).not.toHaveBeenCalled()
  })

  it('cancels change-library confirm without calling changeLibraryFolder', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(change).not.toHaveBeenCalled()
  })

  it('changes sort via the sort menu', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [
        { id: 'b1', title: 'Zulu', spreadCount: 1 },
        { id: 'b2', title: 'Alpha', spreadCount: 1 },
      ],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('lib-sort')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('lib-sort'))
    await screen.findByTestId('lib-sort-menu')
    fireEvent.click(screen.getByText('Title'))
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Sort books: Title' }),
      ).toBeTruthy()
    })
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
    const newBook = screen.getByTestId('new-book')
    expect(
      newBook.getAttribute('data-disabled') ??
        newBook.getAttribute('aria-disabled') ??
        newBook.getAttribute('disabled'),
    ).toBeTruthy()
  })

  it('shows singular and plural book counts', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [{ id: 'b1', title: 'One' }],
    })
    const one = render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('book-count').textContent).toBe('1 book')
    })
    one.unmount()

    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [
        { id: 'b1', title: 'One' },
        { id: 'b2', title: 'Two' },
      ],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('book-count').textContent).toBe('2 books')
    })
  })

  it('create dialog starts closed on empty library', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('create-book-dialog')).toBeNull()
    expect(screen.queryByTestId('create-book')).toBeNull()
  })

  it('toolbar Create book opens dialog when books exist', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    const create = vi.spyOn(projectSession, 'createBookInLibrary')
    create.mockResolvedValue({
      ok: true,
      value: makeBook({ id: 'n2', title: 'More', gallery: [] }),
    })
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [{ id: 'b1', title: 'One' }],
    })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-books')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('new-book'))
    await waitFor(() => {
      expect(screen.getByTestId('create-book-dialog')).toBeTruthy()
    })
    const confirm = screen.getByTestId('create-book')
    expect(
      confirm.getAttribute('data-disabled') ??
        confirm.getAttribute('aria-disabled'),
    ).toBeFalsy()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(create).toHaveBeenCalled()
    })
  })

  it('homeError surfaces on the library screen', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue({
      ok: true,
      value: [],
    })
    patchProjectSessionSnapshotForTests({ homeError: 'Could not change' })
    render(<LibraryScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('library-error').textContent).toMatch(
        /Could not change/,
      )
    })
  })
})

function assertOk<T>(
  result: { ok: true; value: T } | { ok: false },
): asserts result is { ok: true; value: T } {
  expect(result.ok).toBe(true)
}
