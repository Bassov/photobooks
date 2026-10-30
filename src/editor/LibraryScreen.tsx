import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { normalizeBookTitleInput, type BookSummary } from '../project'
import { AlertDialog } from '../ui/AlertDialog'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu'
import { Status } from '../ui/Status'
import { BookTile } from './BookTile'
import { CreateBookDialog } from './CreateBookDialog'
import { LibSearch } from './LibSearch'
import { LibSort } from './LibSort'
import {
  filterAndSortLibraryBooks,
  toLibraryGridBook,
  type LibrarySortKey,
} from './libraryBookFilter'
import { libraryBookMenuEffect } from './libraryBookMenu'
import { shouldSkipLibraryRename } from './libraryRename'
import { ensureLibraryScreenStyles } from './libraryScreenStyles'
import { LibraryBar } from './LibraryBar'
import { LibraryEmpty } from './LibraryEmpty'
import { SettingsScreen } from './SettingsScreen'
import {
  changeLibraryFolder,
  createBookInLibrary,
  deleteBookInLibrary,
  duplicateBookInLibrary,
  getProjectSessionSnapshot,
  listLibraryBooks,
  openBookFromLibrary,
  regrantLibrary,
  renameBookInLibrary,
  subscribeProjectSession,
} from './projectSession'
import { ensureScreenPlaceholderStyles } from './screenPlaceholdersStyles'

ensureLibraryScreenStyles()
ensureScreenPlaceholderStyles()

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function LibraryScreen() {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )
  const [books, setBooks] = useState<readonly BookSummary[]>([])
  // Until the first listing lands, show neither the empty state nor the grid:
  // a flash of LibraryEmpty swaps its Create book for the header one mid-click.
  const [booksListed, setBooksListed] = useState(false)
  const [listFailed, setListFailed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmChange, setConfirmChange] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<LibrarySortKey>('edited')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [removingOpen, setRemovingOpen] = useState(false)
  const [removingTitle, setRemovingTitle] = useState('')
  const pendingRemoveId = useRef('')

  const busy = project.actionBusy || project.restorePending
  const folderName = project.libraryLabel ?? 'Library'
  const needsRegrant = project.accessPhase === 'permission-required'

  useEffect(() => {
    if (project.restorePending || needsRegrant) {
      return
    }
    const ac = new AbortController()
    void listLibraryBooks().then((listed) => {
      if (ac.signal.aborted) {
        return
      }
      setBooksListed(true)
      if (!listed.ok) {
        setListFailed(true)
        setBooks([])
        return
      }
      setListFailed(false)
      setBooks(listed.value)
    })
    return () => {
      ac.abort()
    }
  }, [
    project.restorePending,
    project.libraryId,
    project.recentsRevision,
    needsRegrant,
  ])

  const refreshBooks = async (): Promise<void> => {
    const listed = await listLibraryBooks()
    if (!listed.ok) {
      setListFailed(true)
      setBooks([])
      return
    }
    setListFailed(false)
    setBooks(listed.value)
  }

  const gridBooks = useMemo(
    () => books.map((summary) => toLibraryGridBook(summary)),
    [books],
  )
  const shown = useMemo(
    () => filterAndSortLibraryBooks(gridBooks, query, sort),
    [gridBooks, query, sort],
  )

  if (project.restorePending) {
    return (
      <main
        className="pb-library relative flex h-dvh min-h-dvh w-full flex-col overflow-hidden"
        data-testid="library-screen"
      >
        <p
          className="px-6 py-9 text-sm text-muted-foreground"
          data-testid="library-loading"
        >
          Loading…
        </p>
      </main>
    )
  }

  if (needsRegrant) {
    return (
      <main
        className="pb-library relative flex h-dvh min-h-dvh w-full flex-col overflow-hidden"
        data-testid="library-screen"
      >
        <EmptyState
          icon={<Icon name="folder" size={20} />}
          title="Allow library access"
          description={`Allow access to continue with “${folderName}”.`}
          actions={
            <Button
              data-testid="allow-library-access"
              isDisabled={busy}
              onPress={() => {
                void regrantLibrary()
              }}
            >
              {`Allow access to ${folderName}`}
            </Button>
          }
        />
        {project.homeError ? <Status>{project.homeError}</Status> : null}
      </main>
    )
  }

  const barTools: ReactNode =
    books.length > 0 ? (
      <>
        <LibSearch value={query} onChange={setQuery} />
        <LibSort value={sort} onChange={setSort} />
      </>
    ) : null

  const commitRename = (bookId: string, nextRaw: string): void => {
    setRenamingId(null)
    void (async () => {
      const next = normalizeBookTitleInput(nextRaw)
      const current = books.find((b) => b.id === bookId)
      if (shouldSkipLibraryRename(current?.title, next)) {
        return
      }
      const renamed = await renameBookInLibrary(bookId, next)
      if (!renamed.ok) {
        return
      }
      await refreshBooks()
    })()
  }

  return (
    <main
      className="pb-library relative flex h-dvh min-h-dvh w-full flex-col overflow-hidden text-foreground"
      data-testid="library-screen"
    >
      <div
        className={
          settingsOpen
            ? 'hidden'
            : 'flex min-h-0 flex-1 flex-col overflow-hidden'
        }
        aria-hidden={settingsOpen ? true : undefined}
      >
        <LibraryBar
          path={folderName}
          changeDisabled={busy}
          settingsDisabled={busy}
          tools={barTools}
          onChange={() => {
            setConfirmChange(true)
          }}
          onSettings={() => {
            setSettingsMounted(true)
            setSettingsOpen(true)
          }}
        />
        <div className="pb-library-main relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col px-12">
            <div className="flex shrink-0 items-end justify-between gap-4 pb-2 pt-10">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="pb-library-heading">Your books</h1>
                {books.length >= 1 ? (
                  <span
                    className="shrink-0 text-sm text-muted-foreground"
                    data-testid="book-count"
                  >
                    {books.length} {books.length === 1 ? 'book' : 'books'}
                  </span>
                ) : null}
              </div>
              {books.length > 0 ? (
                <Button
                  className="pb-lib-create-sm shrink-0"
                  isDisabled={busy}
                  onPress={() => {
                    setCreateOpen(true)
                  }}
                  data-testid="new-book"
                >
                  Create book
                </Button>
              ) : null}
            </div>

            {listFailed ? (
              <EmptyState
                title="Could not list books"
                description="Something went wrong reading this library folder."
                actions={
                  <Button
                    data-testid="library-retry"
                    onPress={() => {
                      void refreshBooks()
                    }}
                  >
                    Retry
                  </Button>
                }
              />
            ) : !booksListed ? null : books.length === 0 ? (
              <LibraryEmpty
                createDisabled={busy}
                onCreate={() => {
                  setCreateOpen(true)
                }}
              />
            ) : shown.length === 0 ? (
              <div
                className="mt-20 text-center text-sm text-muted-foreground"
                data-testid="lib-no-results"
              >
                No books match “{query.trim()}”.{' '}
                <button
                  type="button"
                  className="m-0 inline cursor-pointer border-0 bg-transparent p-0 text-inherit underline underline-offset-2"
                  data-testid="lib-clear-search"
                  onClick={() => {
                    setQuery('')
                  }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div
                className="pb-library-scroll min-h-0 flex-1 overflow-y-auto"
                data-testid="library-scroll"
                data-scrollport="library"
              >
                <div
                  className="pb-library-grid pb-12"
                  data-testid="library-books"
                >
                  {shown.map((book) => {
                    const summary = books.find((b) => b.id === book.id)
                    return (
                      <BookTile
                        key={book.id}
                        book={book}
                        onOpen={() => {
                          if (busy) {
                            return
                          }
                          void openBookFromLibrary(book.id)
                        }}
                        title={
                          renamingId === book.id ? (
                            <input
                              aria-label="Book title"
                              defaultValue={book.displayTitle}
                              autoFocus
                              className="pb-lib-rename h-7 w-full rounded-md bg-field px-2 text-sm outline-hidden focus-visible:outline-1 focus-visible:outline-[#535152]"
                              data-testid="rename-input"
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  commitRename(
                                    book.id,
                                    (event.target as HTMLInputElement).value,
                                  )
                                }
                                if (event.key === 'Escape') {
                                  setRenamingId(null)
                                }
                              }}
                              onBlur={(event) => {
                                commitRename(book.id, event.target.value)
                              }}
                            />
                          ) : undefined
                        }
                        menu={
                          <MenuTrigger>
                            <IconButton
                              label="Book actions"
                              size="sm"
                              tooltip={false}
                              className="pb-lib-book-menu size-8"
                              data-testid={`book-menu-${book.id}`}
                              isDisabled={busy}
                            >
                              <Icon name="moreHorizontal" size={16} />
                            </IconButton>
                            <MenuPopover
                              placement="bottom end"
                              className="w-44"
                            >
                              <Menu
                                className="pb-lib-book-actions [&_svg]:size-4"
                                onAction={(key) => {
                                  const effect = libraryBookMenuEffect(
                                    String(key),
                                    summary?.title,
                                  )
                                  if (effect.type === 'open') {
                                    void openBookFromLibrary(book.id)
                                    return
                                  }
                                  if (effect.type === 'rename') {
                                    setRenamingId(book.id)
                                    return
                                  }
                                  if (effect.type === 'duplicate') {
                                    void (async () => {
                                      const duplicated =
                                        await duplicateBookInLibrary(book.id)
                                      if (duplicated.ok) {
                                        await refreshBooks()
                                      }
                                    })()
                                    return
                                  }
                                  if (effect.type === 'remove' && summary) {
                                    pendingRemoveId.current = summary.id
                                    setRemovingTitle(effect.title)
                                    setRemovingOpen(true)
                                  }
                                }}
                              >
                                <MenuItem id="open" textValue="Open">
                                  <Icon name="folderOpen" size={16} />
                                  Open
                                </MenuItem>
                                <MenuItem
                                  id="rename"
                                  textValue="Rename"
                                  data-testid={`library-rename-${book.id}`}
                                >
                                  <Icon name="pencil" size={16} />
                                  Rename
                                </MenuItem>
                                <MenuItem id="dup" textValue="Duplicate">
                                  <Icon name="copy" size={16} />
                                  Duplicate
                                </MenuItem>
                                <MenuSeparator />
                                <MenuItem
                                  id="rm"
                                  textValue="Remove"
                                  variant="destructive"
                                >
                                  <Icon name="delete" size={16} />
                                  Remove…
                                </MenuItem>
                              </Menu>
                            </MenuPopover>
                          </MenuTrigger>
                        }
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {project.homeError ? (
          <Status data-testid="library-error">{project.homeError}</Status>
        ) : null}

        <span style={SR_ONLY} aria-live="polite">
          {folderName}
        </span>

        <CreateBookDialog
          isOpen={createOpen}
          createDisabled={busy}
          onCancel={() => {
            setCreateOpen(false)
          }}
          onCreate={(result) => {
            setCreateOpen(false)
            void createBookInLibrary(result.title, { trim: result.trim })
          }}
        />

        <AlertDialog
          isOpen={confirmChange}
          tone="neutral"
          icon={<Icon name="folderSync" size={16} />}
          title="Change the library folder?"
          confirmLabel="Choose folder…"
          onCancel={() => {
            setConfirmChange(false)
          }}
          onConfirm={() => {
            setConfirmChange(false)
            void changeLibraryFolder()
          }}
        >
          Photobooks works with one library at a time. Your books stay in{' '}
          <span className="font-mono text-sm text-foreground/80">
            {folderName}
          </span>{' '}
          — nothing is moved or deleted. Pick another folder to use it as the
          library (an empty folder starts a new one). Change it back to see
          these books again.
        </AlertDialog>

        <AlertDialog
          isOpen={removingOpen}
          icon={<Icon name="delete" size={16} />}
          title={<>Remove “{removingTitle}”?</>}
          confirmLabel="Remove book"
          onCancel={() => {
            setRemovingOpen(false)
          }}
          onConfirm={() => {
            const targetId = pendingRemoveId.current
            setRemovingOpen(false)
            void (async () => {
              const deleted = await deleteBookInLibrary(targetId)
              if (deleted.ok) {
                await refreshBooks()
              }
            })()
          }}
        >
          The book is removed from your library folder. Photos stay on disk,
          untouched.
        </AlertDialog>
      </div>

      {settingsMounted ? (
        <div
          className={
            settingsOpen
              ? 'absolute inset-0 z-20 flex flex-col bg-background'
              : 'hidden'
          }
          aria-hidden={settingsOpen ? undefined : true}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 bg-chrome px-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4"
              onPress={() => {
                setSettingsOpen(false)
              }}
              data-testid="settings-back"
            >
              <Icon name="chevronLeft" size={16} />
              Library
            </Button>
            <span className="text-sm font-medium">Settings</span>
          </div>
          <div className="min-h-0 flex-1">
            <SettingsScreen
              libraryPath={folderName}
              bookCount={books.length}
              changeDisabled={busy}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}
