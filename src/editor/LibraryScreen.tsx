import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { displayBookTitle, type BookSummary } from '../project'
import { Button } from '../ui/Button'
import { Dialog, DialogTitle } from '../ui/Dialog'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
import { CreateBookDialog } from './CreateBookDialog'
import { ensureLibraryScreenStyles } from './libraryScreenStyles'
import { LibraryBar } from './LibraryBar'
import { LibraryEmpty } from './LibraryEmpty'
import {
  changeLibraryFolder,
  createBookInLibrary,
  getProjectSessionSnapshot,
  listLibraryBooks,
  openBookFromLibrary,
  regrantLibrary,
  renameBookInLibrary,
  subscribeProjectSession,
} from './projectSession'
import { promptBookTitle } from './promptBookTitle'
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
  clip: 'rect(0, 0, 0, 0)',
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
  const [listFailed, setListFailed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

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

  const createTools: ReactNode =
    books.length > 0 ? (
      <Button
        className="pb-lib-create-sm"
        isDisabled={busy}
        onPress={() => {
          setCreateOpen(true)
        }}
        data-testid="new-book"
      >
        Create book
      </Button>
    ) : null

  return (
    <main
      className="pb-library relative flex h-dvh min-h-dvh w-full flex-col overflow-hidden text-foreground"
      data-testid="library-screen"
    >
      <LibraryBar
        path={folderName}
        changeDisabled={busy}
        settingsDisabled={busy}
        tools={createTools}
        onChange={() => {
          void changeLibraryFolder()
        }}
        onSettings={() => {
          setSettingsOpen(true)
        }}
      />
      <div className="pb-library-main relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col px-12">
          <div className="flex shrink-0 items-end justify-between pb-2 pt-10">
            <div className="flex items-baseline gap-3">
              <h1 className="pb-library-heading">Your books</h1>
              {books.length >= 1 ? (
                <span
                  className="text-sm text-muted-foreground"
                  data-testid="book-count"
                >
                  {books.length} {books.length === 1 ? 'book' : 'books'}
                </span>
              ) : null}
            </div>
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
          ) : books.length === 0 ? (
            <LibraryEmpty
              createDisabled={busy}
              onCreate={() => {
                setCreateOpen(true)
              }}
            />
          ) : (
            <div
              className="pb-library-scroll min-h-0 flex-1 overflow-y-auto"
              data-testid="library-scroll"
              data-scrollport="library"
            >
              <ul className="pb-library-list pb-12" data-testid="library-books">
                {books.map((book) => (
                  <li key={book.id}>
                    <Button
                      variant="ghost"
                      data-testid={`library-book-${book.id}`}
                      isDisabled={busy}
                      onPress={() => {
                        void openBookFromLibrary(book.id)
                      }}
                    >
                      {displayBookTitle(book.title)}
                    </Button>
                    <Button
                      variant="ghost"
                      data-testid={`library-rename-${book.id}`}
                      isDisabled={busy}
                      onPress={() => {
                        void (async () => {
                          const next = promptBookTitle(
                            'Rename book',
                            displayBookTitle(book.title),
                          )
                          if (next === null) {
                            return
                          }
                          const renamed = await renameBookInLibrary(
                            book.id,
                            next,
                          )
                          if (!renamed.ok) {
                            return
                          }
                          await refreshBooks()
                        })()
                      }}
                    >
                      Rename
                    </Button>
                  </li>
                ))}
              </ul>
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

      <Dialog
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        data-testid="settings-dialog"
      >
        <DialogTitle>Settings</DialogTitle>
        <p>Settings coming soon</p>
        <Button
          data-testid="settings-close"
          onPress={() => {
            setSettingsOpen(false)
          }}
        >
          Close
        </Button>
      </Dialog>
    </main>
  )
}
