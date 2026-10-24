import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { displayBookTitle, type BookSummary } from '../project'
import { Button } from '../ui/Button'
import { Dialog, DialogTitle } from '../ui/Dialog'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
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
import './screenPlaceholders.css'

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
      <main className="pb-screen" data-testid="library-screen">
        <p data-testid="library-loading">Loading…</p>
      </main>
    )
  }

  if (needsRegrant) {
    return (
      <main className="pb-screen" data-testid="library-screen">
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

  return (
    <main className="pb-screen" data-testid="library-screen">
      <h1 className="heading">Library</h1>
      <div className="pb-library-toolbar">
        <Button
          data-testid={books.length === 0 ? 'create-book' : 'new-book'}
          isDisabled={busy}
          onPress={() => {
            void (async () => {
              const title = promptBookTitle('New book', '')
              if (title === null) {
                return
              }
              await createBookInLibrary(title)
            })()
          }}
        >
          {books.length === 0 ? 'Create book' : 'New book'}
        </Button>
        <Button
          variant="secondary"
          data-testid="change-library"
          isDisabled={busy}
          onPress={() => {
            void changeLibraryFolder()
          }}
        >
          Change library
        </Button>
        <span
          className="pb-library-folder"
          data-testid="library-folder-name"
          title={folderName}
        >
          {folderName}
        </span>
        <Button
          variant="ghost"
          data-testid="library-settings"
          isDisabled={busy}
          onPress={() => {
            setSettingsOpen(true)
          }}
        >
          Settings
        </Button>
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
        <EmptyState
          data-testid="library-empty"
          icon={<Icon name="folder" size={20} />}
          title="No books yet"
          description="Create a book to start laying out photos."
        />
      ) : (
        <div
          className="pb-library-scroll"
          data-testid="library-scroll"
          data-scrollport="library"
        >
          <ul className="pb-library-list" data-testid="library-books">
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
                      const renamed = await renameBookInLibrary(book.id, next)
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

      {project.homeError ? (
        <Status data-testid="library-error">{project.homeError}</Status>
      ) : null}

      <span style={SR_ONLY} aria-live="polite">
        {folderName}
      </span>

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
