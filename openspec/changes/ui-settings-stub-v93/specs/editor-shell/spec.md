## MODIFIED Requirements

### Requirement: Library screen (empty and with books)

With a granted library handle and no in-tab active book, the system SHALL show the library surface matching kit empty-library chrome when `listBooks()` is empty: example book cover, plain CC BY-SA `screen-credit` (no capsule), and a primary black Create book that opens the shared Create book dialog — no “0 books” copy. When books exist, it MUST list them (open on activation), and offer Create book (same dialog), Change library (showing the current folder name as the path), and Settings. Settings MUST open the kit Settings shell (Library section live; Hosting / Site / Print / Interface deferred) with a back control that returns to the library surface without changing the session surface. Library overflow scrolls only in a named library scrollport (`library-scroll` / `data-scrollport="library"`); no page-level H/V scroll. Actions MUST serialize while busy. The surface MUST expose one page `h1` and visible `:focus-visible` rings on list controls.

#### Scenario: Empty library offers create

- **WHEN** the granted library has no books
- **THEN** the empty library surface shows the example book, plain screen credit, Create book, and no book list rows

#### Scenario: Create book dialog

- **WHEN** the user activates Create book, enters a title and page size, and confirms
- **THEN** a new book is persisted with that title and trim and becomes the active editor book; cancel leaves the library unchanged

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book with a granted handle
- **THEN** the editor shows that book’s gallery and placements

#### Scenario: Change library updates the folder name

- **WHEN** the user changes the library to another folder successfully
- **THEN** the library surface shows that folder’s name as the current path and lists that folder’s books

#### Scenario: Settings opens kit shell

- **WHEN** the user opens Settings from the library surface
- **THEN** the kit Settings shell is shown with a live library folder name and book count, and Back returns to the library

## ADDED Requirements

### Requirement: Settings shell (library section live)

The Settings shell SHALL match kit settings chrome: a section nav (Library, Hosting, Site, Print presets, Interface) and a content pane. The Library section MUST show the current library folder name/path, a live book count from the library list (session `listLibraryBooks` / storage `listBooks()`), and **Change library folder…** that uses the same confirm dialog and FSA `changeLibraryFolder` path as the library bar. Cancel on confirm MUST leave the library unchanged. Hosting, Site, Print presets, and Interface MUST be read-only “coming later” copy with no fake editable inputs. Settings content overflow scrolls only in a named settings scrollport (`settings-scroll` / `data-scrollport="settings"`); there MUST be no page-level H/V scroll. Settings MUST NOT introduce card borders on the Library panel (chrome surface + rules only).

#### Scenario: Live book count

- **WHEN** Settings Library is open with N books in the granted library
- **THEN** the settings book count shows N

#### Scenario: Change library from Settings

- **WHEN** the user confirms Change library folder… in Settings and picks a folder successfully
- **THEN** the library binding updates the same way as Change from the library bar

#### Scenario: Deferred sections are read-only

- **WHEN** the user opens Hosting, Site, Print presets, or Interface
- **THEN** the pane shows coming-later copy without controls that look editable
