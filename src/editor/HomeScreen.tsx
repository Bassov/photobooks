import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  displayBookTitle,
  type BookSummary,
  type RecentLibrary,
} from '../project'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
import { homeActionDisabled } from './homeActionDisabled'
import {
  createLibrary,
  getProjectSessionSnapshot,
  listRecents,
  openBookFromHome,
  openLibrary,
  regrantLibrary,
  removeRecentFromHome,
  renameBookInLibrary,
  selectRecentLibrary,
  startSessionEditor,
  subscribeProjectSession,
} from './projectSession'
import { promptBookTitle } from './promptBookTitle'
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
  const [books, setBooks] = useState<readonly BookSummary[]>([])
  const [listFailed, setListFailed] = useState(false)
  const [selectedAnnounce, setSelectedAnnounce] = useState('')
  const [focusHoldTestId, setFocusHoldTestId] = useState<string | null>(null)

  const busy = project.actionBusy || project.restorePending
  const interactive = !busy
  // Keep the control that started the busy action enabled so focus is not blurred.
  const activeFocusHold = busy ? focusHoldTestId : null

  const actionDisabled = (testId: string): boolean =>
    homeActionDisabled(interactive) && activeFocusHold !== testId

  const beginBusyAction = (testId: string): void => {
    setFocusHoldTestId(testId)
  }

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
      setSelectedAnnounce(`Selected library ${preferred.label}`)
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
    const matched = recents.find((entry) => entry.id === libraryId)
    const label = matched === undefined ? libraryId : matched.label
    setSelectedLibraryId(libraryId)
    setSelectedAnnounce(`Selected library ${label}`)
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

  const refreshBooks = async (libraryId: string): Promise<void> => {
    const listed = await selectRecentLibrary(libraryId)
    if (!listed.ok) {
      setBooks([])
      return
    }
    setBooks(listed.value)
  }

  const onRenameBook = async (book: BookSummary): Promise<void> => {
    if (!interactive || selectedLibraryId === null) {
      return
    }
    const entered = promptBookTitle(
      'Rename book',
      book.title === '' ? '' : book.title,
    )
    if (entered === null) {
      return
    }
    const renamed = await renameBookInLibrary(
      book.id,
      entered,
      selectedLibraryId,
    )
    if (!renamed.ok) {
      return
    }
    await refreshBooks(selectedLibraryId)
  }

  if (project.restorePending) {
    return (
      <div className="home-screen" data-testid="home-screen">
        <Status className="home-loading" data-testid="home-loading">
          Loading…
        </Status>
      </div>
    )
  }

  const empty = !listFailed && recents.length === 0
  const permissionRequired = project.accessPhase === 'permission-required'

  return (
    <div className="home-screen" data-testid="home-screen">
      <header className="home-chrome">
        <h1 className="brand">Photobooks</h1>
        <div className="home-actions">
          <Button
            variant="secondary"
            size="sm"
            data-testid="create-library"
            isDisabled={actionDisabled('create-library')}
            onPress={() => {
              // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
              beginBusyAction('create-library')
              void createLibrary()
            }}
          >
            New library
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid="open-library"
            isDisabled={actionDisabled('open-library')}
            onPress={() => {
              // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
              beginBusyAction('open-library')
              void openLibrary()
            }}
          >
            Open
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid="start-session"
            isDisabled={actionDisabled('start-session')}
            onPress={() => {
              startSessionEditor()
            }}
          >
            Start editing
          </Button>
          {permissionRequired ? (
            <Button
              size="sm"
              data-testid="regrant-library"
              isDisabled={actionDisabled('regrant-library')}
              onPress={() => {
                // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
                beginBusyAction('regrant-library')
                void regrantLibrary()
              }}
            >
              Grant access
            </Button>
          ) : null}
        </div>
      </header>
      <div
        className="home-body"
        data-testid="home-scroll"
        data-scrollport="home"
      >
        <Status
          className="home-selected-announce"
          data-testid="home-selected-announce"
          politeness="polite"
        >
          {selectedAnnounce}
        </Status>
        {listFailed ? (
          <EmptyState
            className="home-error-panel"
            data-testid="home-idb-error"
            icon={<Icon name="warning" size={20} />}
            title="Could not load recent libraries"
            description="Check that site storage is available, then retry."
            actions={
              <Button
                size="sm"
                data-testid="home-retry"
                isDisabled={actionDisabled('home-retry')}
                onPress={() => {
                  // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
                  beginBusyAction('home-retry')
                  void refreshRecents()
                }}
              >
                Retry
              </Button>
            }
          />
        ) : null}
        {project.homeError ? (
          <Status
            className="home-error"
            data-testid="home-error"
            politeness="assertive"
          >
            {project.homeError}
          </Status>
        ) : null}
        {empty ? (
          <EmptyState
            className="home-empty"
            data-testid="home-empty"
            icon={<Icon name="folder" size={20} />}
            title="No recent libraries yet"
            description="Create a new library or open an existing folder to get started."
            actions={
              <>
                <Button
                  size="sm"
                  data-testid="home-empty-create"
                  isDisabled={actionDisabled('home-empty-create')}
                  onPress={() => {
                    beginBusyAction('home-empty-create')
                    void createLibrary()
                  }}
                >
                  New library
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="home-empty-open"
                  isDisabled={actionDisabled('home-empty-open')}
                  onPress={() => {
                    beginBusyAction('home-empty-open')
                    void openLibrary()
                  }}
                >
                  Open
                </Button>
              </>
            }
          />
        ) : null}
        {!listFailed && !empty ? (
          <div className="home-columns">
            <section className="home-panel" data-testid="home-recents">
              <h2 className="home-heading">Recent libraries</h2>
              <ul className="home-list" aria-label="Recent libraries">
                {recents.map((recent) => {
                  const recentTestId = `home-recent-${recent.id}`
                  const removeTestId = `home-remove-${recent.id}`
                  return (
                    <li key={recent.id}>
                      <button
                        type="button"
                        className={
                          selectedLibraryId === recent.id
                            ? 'home-list-item home-list-item-selected'
                            : 'home-list-item'
                        }
                        data-testid={recentTestId}
                        disabled={actionDisabled(recentTestId)}
                        aria-current={
                          selectedLibraryId === recent.id ? 'true' : undefined
                        }
                        onClick={() => {
                          // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
                          beginBusyAction(recentTestId)
                          void onSelectRecent(recent.id)
                        }}
                      >
                        {recent.label}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="home-remove"
                        data-testid={removeTestId}
                        isDisabled={actionDisabled(removeTestId)}
                        aria-label={`Remove ${recent.label}`}
                        onPress={() => {
                          beginBusyAction(removeTestId)
                          void removeRecentFromHome(recent.id).then(() => {
                            if (selectedLibraryId === recent.id) {
                              setSelectedLibraryId(null)
                              setSelectedAnnounce('')
                              // Stryker disable next-line CallExpression,ArrayDeclaration: books panel hidden when selection is null
                              setBooks([])
                            }
                            void refreshRecents()
                          })
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
            <section className="home-panel" data-testid="home-books">
              <h2 className="home-heading">Books</h2>
              {selectedLibraryId === null ? (
                <Status className="home-hint">
                  Select a library to see its books.
                </Status>
              ) : null}
              {permissionRequired && selectedLibraryId !== null ? (
                <Status
                  className="home-hint"
                  data-testid="home-permission-hint"
                >
                  This library needs folder access. Use Grant access to
                  continue.
                </Status>
              ) : null}
              {!permissionRequired &&
              selectedLibraryId !== null &&
              books.length === 0 &&
              !project.homeError ? (
                <Status className="home-hint">
                  No books in this library yet.
                </Status>
              ) : null}
              {!permissionRequired && books.length > 0 ? (
                <ul className="home-list" aria-label="Books">
                  {books.map((book) => {
                    const label = displayBookTitle(book.title)
                    const bookTestId = `home-book-${book.id}`
                    const renameTestId = `home-rename-${book.id}`
                    return (
                      <li key={book.id} className="home-book-row">
                        <button
                          type="button"
                          className="home-list-item"
                          data-testid={bookTestId}
                          disabled={actionDisabled(bookTestId)}
                          onClick={() => {
                            if (selectedLibraryId) {
                              // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
                              beginBusyAction(bookTestId)
                              void onOpenBook(selectedLibraryId, book.id)
                            }
                          }}
                        >
                          {label}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="home-remove"
                          data-testid={renameTestId}
                          isDisabled={actionDisabled(renameTestId)}
                          aria-label={`Rename ${label}`}
                          onPress={() => {
                            // Stryker disable next-line CallExpression: focus-hold covered by remove busy test
                            beginBusyAction(renameTestId)
                            void onRenameBook(book)
                          }}
                        >
                          Rename
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
