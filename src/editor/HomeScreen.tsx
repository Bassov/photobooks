import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RecentLibrary } from '../project'
import {
  createLibrary,
  getProjectSessionSnapshot,
  listRecents,
  openBookFromHome,
  openLibrary,
  regrantLibrary,
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
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listRecents().then((next) => {
      if (!cancelled) {
        setRecents(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [project.accessPhase, project.libraryId, project.recentsRevision])

  const onSelectRecent = async (libraryId: string): Promise<void> => {
    setBusy(true)
    setListError(null)
    setSelectedLibraryId(libraryId)
    try {
      const listed = await selectRecentLibrary(libraryId)
      if (!listed.ok) {
        setBooks([])
        if (listed.code !== 'permission-required') {
          setListError(`Could not list books: ${listed.code}`)
        }
        return
      }
      setBooks(listed.value)
    } finally {
      setBusy(false)
    }
  }

  const onOpenBook = async (
    libraryId: string,
    bookId: string,
  ): Promise<void> => {
    setBusy(true)
    setListError(null)
    try {
      const opened = await openBookFromHome(libraryId, bookId)
      if (!opened.ok && opened.code !== 'permission-required') {
        setListError(`Could not open book: ${opened.code}`)
      }
    } finally {
      setBusy(false)
    }
  }

  const empty = recents.length === 0

  return (
    <div className="home-screen" data-testid="home-screen">
      <header className="home-chrome">
        <p className="brand">Photobooks</p>
        <div className="home-actions">
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-library"
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
            onClick={() => {
              startSessionEditor()
            }}
          >
            Start editing
          </button>
          {project.accessPhase === 'permission-required' ? (
            <button
              type="button"
              className="editor-action"
              data-testid="regrant-library"
              disabled={busy}
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
        {empty ? (
          <p className="home-empty" data-testid="home-empty">
            No recent libraries yet. Create a new library or open an existing
            folder to get started.
          </p>
        ) : (
          <div className="home-columns">
            <section
              className="home-panel"
              aria-label="Recent libraries"
              data-testid="home-recents"
            >
              <h2 className="home-heading">Recent libraries</h2>
              <ul className="home-list">
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
                      disabled={busy}
                      onClick={() => {
                        void onSelectRecent(recent.id)
                      }}
                    >
                      {recent.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section
              className="home-panel"
              aria-label="Books"
              data-testid="home-books"
            >
              <h2 className="home-heading">Books</h2>
              {listError ? (
                <p className="home-error" role="status">
                  {listError}
                </p>
              ) : null}
              {selectedLibraryId === null ? (
                <p className="home-hint">Select a library to see its books.</p>
              ) : books.length === 0 &&
                project.accessPhase !== 'permission-required' &&
                !listError ? (
                <p className="home-hint">No books in this library yet.</p>
              ) : (
                <ul className="home-list">
                  {books.map((book) => (
                    <li key={book.id}>
                      <button
                        type="button"
                        className="home-list-item"
                        data-testid={`home-book-${book.id}`}
                        disabled={busy}
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
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
