# Spec Delta

## ADDED Requirements

### Requirement: Home screen for returning users

When the app opens with no in-tab active book to restore, the system SHALL show a home screen as the primary surface instead of the editor workspace. The home screen MUST list recent libraries from session state and MUST offer create-library and open-library actions.

#### Scenario: Empty home with no recents

- **WHEN** the user opens the app with no recent libraries and no in-tab active book to restore
- **THEN** the home screen shows empty copy plus create-library and open-library actions, and the document does not grow page-level H/V scrollbars

#### Scenario: Home lists recent libraries

- **WHEN** the user previously opened a library so it is remembered in session state, then opens the app with no in-tab active book to restore
- **THEN** the home screen lists that recent library by its display label

### Requirement: Home lists books for a selected recent library

Selecting a recent library on the home screen MUST list that library’s books when the remembered handle can be used. When recalling the handle returns `permission-required`, the system MUST show the existing re-grant control and MUST NOT show a silent empty book list.

#### Scenario: Home lists books for a recent library

- **WHEN** the home screen shows a recent library whose handle is granted and that library contains saved books
- **THEN** those books are listed so the user can choose one

#### Scenario: Permission-required selecting a recent uses re-grant

- **WHEN** the user selects a recent library whose handle recall returns `permission-required`
- **THEN** the re-grant control is available and the UI does not show a silent empty book list for that library

### Requirement: Home scrollport containment

The home screen MUST remain viewport-contained (no page-level H/V scroll). When the recent or book list overflows the viewport, scrolling MUST occur only inside a named home scrollport.

#### Scenario: Home overflow stays in named scrollport

- **WHEN** the home recent or book list is longer than the viewport
- **THEN** scrolling occurs only inside the named home scrollport and the document does not grow page-level H/V scrollbars

### Requirement: Open book from home in one click

From the home screen, activating a listed book MUST open that book into the editor in one activation when the library handle is granted. The editor MUST show that book’s gallery and placements. After a successful open, filmstrip and pasteboard MUST be the named editor scrollports. When recall returns `permission-required`, the system MUST use the existing re-grant control.

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book on the home screen for a recent library with a granted handle
- **THEN** the editor becomes the active surface showing that book’s gallery and placements

#### Scenario: Permission-required opening a book uses re-grant

- **WHEN** the user activates a listed book and handle recall returns `permission-required`
- **THEN** the re-grant control is available and the editor does not open an empty silent library

## MODIFIED Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip when the editor surface is active. When the app opens with no in-tab active book to restore, the home screen MUST be the primary surface instead of the editor shell. The legacy single photo-card success screen MUST NOT be the primary layout.

#### Scenario: Shell visible on load

- **WHEN** the editor surface is active (including after opening a book or restoring an in-tab active book)
- **THEN** a workspace region and a filmstrip region are visible, and the legacy single photo-card success screen is not the primary layout

#### Scenario: Home is primary without in-tab book

- **WHEN** the user opens the app with no in-tab active book to restore
- **THEN** the home screen is the primary surface and the editor workspace and filmstrip are not required to be visible

### Requirement: Workspace hosts the pasteboard

When the editor surface is active, the editor workspace SHALL show the book's pasteboard. It MUST NOT show a placeholder sentence in place of that pasteboard.

#### Scenario: Workspace is not a placeholder

- **WHEN** the editor surface is active
- **THEN** the workspace shows the pasteboard and does not show a sentence that the pasteboard arrives later

### Requirement: Create or open a library folder

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker. With no library open, create/open actions MUST be available from the home screen (and MAY remain reachable from editor chrome after leaving home). Opening or creating MUST remember the library handle in session state for later restore and MUST update the recent-libraries list. After a successful **create** with no active book id, the system MUST adopt the current in-memory book so Save can persist it without a destructive empty-book create. After a successful **open** of a library that already contains books, when the editor has no gallery or placements, the system MUST load a stored book into the editor (preferring a book with content over an empty placeholder) instead of adopting a fresh empty session book. When the editor already has session content, open MUST still adopt that work without clearing gallery or placements. The shell MUST remain viewport-contained (no page-level H/V scroll; home, filmstrip, and pasteboard stay the named scrollports for their respective surfaces).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open and no in-tab active book to restore
- **THEN** create-library and open-library actions are visible on the home screen and the document does not grow page-level H/V scrollbars

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

#### Scenario: Create library adopts in-memory book

- **WHEN** the user creates a library while an in-memory book is already in the editor and no book id is active
- **THEN** that book becomes the active library-backed book without clearing gallery or placements

#### Scenario: Open existing library loads stored book

- **WHEN** the user opens a library that already contains a saved book and the editor is empty
- **THEN** the editor shows that book’s gallery and placements without requiring a reload

#### Scenario: Open prefers filled book over empty session book

- **WHEN** the library contains an empty session-book placeholder and another book with gallery content, and the editor is empty
- **THEN** open activates the filled book

### Requirement: Restore book after reload when handle is granted

After a successful save, when the tab is reloaded and session state can recall a library handle that still has readwrite permission **and** an in-tab active book id is still present, the system SHALL restore the previously active library-backed book so gallery ids and placements match what was saved. When the tab opens without an in-tab active book id, the system MUST show the home screen (recent libraries) instead of auto-entering the editor.

#### Scenario: Reload restores saved book

- **WHEN** the user has saved a library-backed book, the tab reloads, and the remembered library handle is still granted with an in-tab active book id present
- **THEN** the editor restores the same book id with the same gallery ids and placements

#### Scenario: Fresh visit shows home with recents

- **WHEN** the user previously used a library so it is recent, then opens the app with no in-tab active book id
- **THEN** the home screen is shown listing that recent library rather than auto-entering the editor
