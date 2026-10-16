import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RecentLibrary } from '../project'
import {
  createLibrary,
  getProjectSessionSnapshot,
  listRecents,
  openBookFromHome,
  openLibrary,
  regrantLibrary,
  removeRecentFromHome,
  selectRecentLibrary,
  startSessionEditor,
  subscribeProjectSession,
} from './projectSession'
import './HomeScreen.css'

export function HomeScreen() {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )
  const [recents, setRecents] = useState<readonly RecentLibrary[]>([])
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null,
  )
  const [books, setBooks] = useState<readonly { id: string }[]>([])
  const [listFailed, setListFailed] = useState(false)

  const busy = project.actionBusy || project.restorePending
  const interactive = !busy

  const refreshRecents = async (): Promise<void> => {
    const listed = await listRecents()
    if (!listed.ok) {
      setListFailed(true)
      setRecents([])
      return
    }
    setListFailed(false)
    setRecents(listed.value)
    const active = listed.value.find((entry) => entry.id === project.libraryId)
    if (active) {
      setSelectedLibraryId(active.id)
    }
  }

  useEffect(() => {
    if (project.restorePending) {
      return
    }
    void (async () => {
      const listed = await listRecents()
      if (!listed.ok) {
        setListFailed(true)
        setRecents([])
        return
      }
      setListFailed(false)
      setRecents(listed.value)
      const preferred =
        listed.value.find((entry) => entry.id === project.preferredLibraryId) ??
        listed.value[0]
      if (preferred === undefined || selectedLibraryId !== null) {
        return
      }
      setSelectedLibraryId(preferred.id)
      const booksListed = await selectRecentLibrary(preferred.id)
      if (!booksListed.ok) {
        return
      }
      setBooks(booksListed.value)
    })()
    // Only re-run when restore settles or recents revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    project.accessPhase,
    project.libraryId,
    project.recentsRevision,
    project.restorePending,
  ])

  const onSelectRecent = async (libraryId: string): Promise<void> => {
    if (!interactive) {
      return
    }
    setSelectedLibraryId(libraryId)
    setBooks([])
    const listed = await selectRecentLibrary(libraryId)
    if (!listed.ok) {
      setBooks([])
      return
    }
    setBooks(listed.value)
  }

  const onOpenBook = async (
    libraryId: string,
    bookId: string,
  ): Promise<void> => {
    if (!interactive) {
      return
    }
    await openBookFromHome(libraryId, bookId)
  }

  if (project.restorePending) {
    return (
      <div className="home-screen" data-testid="home-screen">
        <p className="home-loading" data-testid="home-loading" role="status">
          Loading…
        </p>
      </div>
    )
  }

  const empty = !listFailed && recents.length === 0
  const permissionRequired = project.accessPhase === 'permission-required'

  return (
    <div className="home-screen" data-testid="home-screen">
      <header className="home-chrome">
        <p className="brand">Photobooks</p>
        <div className="home-actions">
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-library"
            disabled={!interactive}
            onClick={() => {
              void createLibrary()
            }}
          >
            New library
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="open-library"
            disabled={!interactive}
            onClick={() => {
              void openLibrary()
            }}
          >
            Open
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="start-session"
            disabled={!interactive}
            onClick={() => {
              startSessionEditor()
            }}
          >
            Start editing
          </button>
          {permissionRequired ? (
            <button
              type="button"
              className="editor-action"
              data-testid="regrant-library"
              disabled={!interactive}
              onClick={() => {
                void regrantLibrary()
              }}
            >
              Grant access
            </button>
          ) : null}
        </div>
      </header>
      <div
        className="home-body"
        data-testid="home-scroll"
        data-scrollport="home"
      >
        {listFailed ? (
          <div className="home-error-panel" data-testid="home-idb-error">
            <p className="home-error" role="alert">
              Could not load recent libraries. Check that site storage is
              available, then retry.
            </p>
            <button
              type="button"
              className="editor-action"
              data-testid="home-retry"
              disabled={!interactive}
              onClick={() => {
                void refreshRecents()
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        {project.homeError ? (
          <p className="home-error" role="status" data-testid="home-error">
            {project.homeError}
          </p>
        ) : null}
        {empty ? (
          <p className="home-empty" data-testid="home-empty">
            No recent libraries yet. Create a new library or open an existing
            folder to get started.
          </p>
        ) : null}
        {!listFailed && !empty ? (
          <div className="home-columns">
            <section className="home-panel" data-testid="home-recents">
              <h2 className="home-heading">Recent libraries</h2>
              <ul className="home-list" aria-label="Recent libraries">
                {recents.map((recent) => (
                  <li key={recent.id}>
                    <button
                      type="button"
                      className={
                        selectedLibraryId === recent.id
                          ? 'home-list-item home-list-item-selected'
                          : 'home-list-item'
                      }
                      data-testid={`home-recent-${recent.id}`}
                      disabled={!interactive}
                      aria-current={
                        selectedLibraryId === recent.id ? 'true' : undefined
                      }
                      onClick={() => {
                        void onSelectRecent(recent.id)
                      }}
                    >
                      {recent.label}
                    </button>
                    <button
                      type="button"
                      className="home-remove"
                      data-testid={`home-remove-${recent.id}`}
                      disabled={!interactive}
                      aria-label={`Remove ${recent.label}`}
                      onClick={() => {
                        void removeRecentFromHome(recent.id).then(() => {
                          if (selectedLibraryId === recent.id) {
                            setSelectedLibraryId(null)
                            setBooks([])
                          }
                          void refreshRecents()
                        })
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="home-panel" data-testid="home-books">
              <h2 className="home-heading">Books</h2>
              {selectedLibraryId === null ? (
                <p className="home-hint">Select a library to see its books.</p>
              ) : null}
              {permissionRequired && selectedLibraryId !== null ? (
                <p className="home-hint" data-testid="home-permission-hint">
                  This library needs folder access. Use Grant access to
                  continue.
                </p>
              ) : null}
              {!permissionRequired &&
              selectedLibraryId !== null &&
              books.length === 0 &&
              !project.homeError ? (
                <p className="home-hint">No books in this library yet.</p>
              ) : null}
              {!permissionRequired && books.length > 0 ? (
                <ul className="home-list">
                  {books.map((book) => (
                    <li key={book.id}>
                      <button
                        type="button"
                        className="home-list-item"
                        data-testid={`home-book-${book.id}`}
                        disabled={!interactive}
                        onClick={() => {
                          if (selectedLibraryId) {
                            void onOpenBook(selectedLibraryId, book.id)
                          }
                        }}
                      >
                        {book.id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
