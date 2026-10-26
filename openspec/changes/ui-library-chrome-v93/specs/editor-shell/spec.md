## MODIFIED Requirements

### Requirement: Library screen (empty and with books)

With a granted library handle and no in-tab active book, the system SHALL show the library surface matching kit empty-library chrome when `listBooks()` is empty: example book cover, plain CC BY-SA `screen-credit` (no capsule), and a primary black Create book that opens the shared Create book dialog — no “0 books” copy. When books exist, at a desktop viewport (≥1280×800) it MUST show kit library-with-books chrome: black primary **Create book**, quiet **Search books**, **Sort**, and settings gear, all visible and usable; list books as book-shaped cover objects (spine shading, page edge, Lora italic title — not square plates); open on activation; caption meta MUST be `N pages` and, when `editedAtMs` is present on the summary, `N pages · edited <relative>`; Change library (folder name as path) remains available. Settings MUST open the kit Settings shell (Library section live; Hosting / Site / Print / Interface deferred) with a back control that returns to the library surface without changing the session surface. Library overflow scrolls only in a named library scrollport (`library-scroll` / `data-scrollport="library"`); no page-level H/V scroll. Actions MUST serialize while busy. The surface MUST expose one page `h1` and visible `:focus-visible` rings on list controls. Chrome MUST stay tone-only (no blue brand fills); hard nos: grayscale surfaces, black only for Create / canvas-sel / used badges, tone `#CACACA`, no toasts.

#### Scenario: Empty library offers create

- **WHEN** the granted library has no books
- **THEN** the empty library surface shows the example book, plain screen credit, Create book, and no book list rows

#### Scenario: Library-with-books chrome at desktop

- **WHEN** the granted library has at least one book and the viewport is at least 1280×800
- **THEN** Create book (black primary), Search books, Sort, and the settings gear are all visible and usable

#### Scenario: Book covers and edited meta

- **WHEN** a listed book is shown in the grid
- **THEN** its cover is a book-shaped object with an italic heading title, and the caption includes page count plus edited text when `editedAtMs` is available

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
