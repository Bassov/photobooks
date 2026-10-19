# Spec Delta

## ADDED Requirements

### Requirement: Book title display fallback

Wherever the shell shows a book title (home book list and editor chrome), the system SHALL show the document `title` when it is a non-empty string after trim, and SHALL show `"Untitled book"` when the title is missing, empty, or whitespace-only. The fallback MUST NOT be written into library storage as the document title.

#### Scenario: Empty title shows Untitled book

- **WHEN** a listed or open book has an empty or missing `title`
- **THEN** the home list and editor chrome show `"Untitled book"` and a subsequent load of that book still has an empty or missing stored `title`

#### Scenario: Non-empty title shown as stored

- **WHEN** a book has `title` `"Summer"`
- **THEN** the home list and editor chrome show `"Summer"`

### Requirement: Rename book from home and editor

The system SHALL let the user rename a book from the home book list and from the editor chrome. A successful rename MUST update the document `title` and persist it to library storage. Renaming a book that is not the active editor document MUST NOT replace the active editor book. Cancelled rename MUST leave the title unchanged.

#### Scenario: Rename from editor persists

- **WHEN** the user renames the active library-backed book from the editor chrome to `"Trip"` and save completes
- **THEN** library storage holds `title` `"Trip"` for that book id and the chrome shows `"Trip"`

#### Scenario: Rename from home persists without swapping the open book

- **WHEN** the home list shows book A and the editor (or no editor book) is not editing A, and the user renames A to `"Album"`
- **THEN** a later list/load of A shows `"Album"` and the previously active editor document (if any) is unchanged

#### Scenario: Cancelled rename leaves title

- **WHEN** the user starts rename and cancels
- **THEN** the stored and displayed title are unchanged

### Requirement: Rename while filmstrip scrolls stays within frame budget

Title rename MUST be a local document string update that does not introduce layout thrash. Renaming while the filmstrip is scrolling MUST produce zero LoAF entries for the interaction window under the project frame-budget gate.

#### Scenario: Rename during filmstrip scroll has zero LoAF

- **WHEN** the user renames the active book while the filmstrip is scrolling
- **THEN** the measured interaction window reports zero LoAF entries

## MODIFIED Requirements

### Requirement: Create a book in the open library

When a library is open, the system SHALL let the user create a book. Create MUST ask for a title before persisting. Cancelled title entry MUST NOT create a book. An accepted empty or whitespace title MUST store an empty title (displayed via the Untitled fallback). The new book MUST become the active editor document and MUST be persisted under the library's book layout on create, including the chosen title.

#### Scenario: Create book becomes active

- **WHEN** the user creates a book in an open library
- **THEN** the editor shows that book as the active document and a subsequent load of the same book id from library storage returns the created gallery and layout

#### Scenario: Create book asks for title and persists it

- **WHEN** the user creates a book and enters title `"Summer"`
- **THEN** the active document and a subsequent load of that book id have `title` `"Summer"`, and the editor chrome shows `"Summer"`

#### Scenario: Cancelled create does not persist a book

- **WHEN** the user starts create book and cancels the title entry
- **THEN** no new book id is added to library storage and the previously active document (if any) remains active

### Requirement: Home lists books for a selected recent library

Selecting a recent library on the home screen MUST list that library’s books by display title (document `title`, or `"Untitled book"` when empty/missing) when the remembered handle can be used. When recalling the handle returns `permission-required`, the system MUST show a permission hint and the re-grant control and MUST NOT show a silent empty book list.

#### Scenario: Home lists books for a recent library

- **WHEN** the home screen shows a recent library whose handle is granted and that library contains saved books
- **THEN** those books are listed so the user can choose one

#### Scenario: Home lists books by title not raw id

- **WHEN** a library contains a book with `title` `"Summer"` and another with an empty title
- **THEN** the home book list shows `"Summer"` and `"Untitled book"` rather than only the raw book ids as the primary labels

#### Scenario: Permission-required selecting a recent uses re-grant

- **WHEN** the user selects a recent library whose handle recall returns `permission-required`
- **THEN** the books panel shows a permission hint and the re-grant control, not a silent empty book list
