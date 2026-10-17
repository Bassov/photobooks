# Spec Delta

## ADDED Requirements

### Requirement: Leave editor for home

While the editor surface is active, the shell MUST provide a Home control. Activating Home MUST flush pending saves, then release the book lock, clear the in-tab active book id, reset the in-memory document and session assets, and show home. Flush or save-error failure MUST keep the editor with a readable message. After Home, another library MUST NOT receive the previous book file.

#### Scenario: Home control returns to home

- **WHEN** the user activates Home in the editor chrome and any pending save succeeds (or there is nothing to flush)
- **THEN** the home screen is shown, the in-memory book is cleared, and a same-tab reload does not restore the previous book into the editor

#### Scenario: Home after edit persists then leaves

- **WHEN** the user edits a library-backed book and activates Home before the autosave debounce fires
- **THEN** that edit is persisted and the home screen is shown

#### Scenario: Home blocked when save is in error

- **WHEN** the active book is in a save error phase and the user activates Home
- **THEN** the editor stays active with a human-readable message and the book is not cleared

#### Scenario: Home then open other library does not leak the book

- **WHEN** the user leaves a library-backed book with placements via Home, then opens a different library that already has its own book
- **THEN** the editor shows the opened library’s book and that library’s storage does not gain a copy of the previous book file

### Requirement: Re-grant from home opens the remembered book

Re-grant from home MUST prefer `requestPermission` on the stored directory handle. Only when that fails MAY the system fall back to a folder picker. After a picker, the system MUST verify `isSameEntry` against the stored handle before binding; a mismatch MUST show an error and MUST NOT replace the recent. On success, the system MUST open the book the user originally activated when one was pending.

#### Scenario: Grant access uses requestPermission then opens pending book

- **WHEN** the user activates Grant access after choosing a book that required permission and `requestPermission` succeeds
- **THEN** that same book opens in the editor

#### Scenario: Picker mismatch does not bind

- **WHEN** re-grant falls back to the folder picker and the picked folder is not the same entry as the stored handle
- **THEN** the home screen shows an error and the recent library handle is unchanged

#### Scenario: Don't Allow shows a message

- **WHEN** the user denies write permission during re-grant
- **THEN** the home screen shows a human-readable permission message and does not silently do nothing

### Requirement: Same-folder library identity

When creating or opening a library folder that matches an already remembered recent via `isSameEntry`, the system MUST reuse that library id even when the stored handle does not currently have permission. The system MUST NOT insert a duplicate recent for the same folder.

#### Scenario: Reopening the same folder reuses the recent

- **WHEN** the user opens a folder that is already a recent library (including after a browser restart where permission is not yet granted)
- **THEN** session state keeps a single recent entry for that folder

## MODIFIED Requirements

### Requirement: Home screen for returning users

When the app opens with no in-tab active book to restore, the system SHALL show a home screen as the primary surface instead of the editor workspace. Until restore has settled, the system MUST show a non-interactive loading state and MUST NOT accept home actions. The home screen MUST list recent libraries and offer create-library and open-library actions. When listing fails, the home screen MUST show an explicit error state with retry instead of the empty-recents copy. When a last active library id is stored, home MUST preselect that library when it is still recent.

#### Scenario: Empty home with no recents

- **WHEN** the user opens the app with no recent libraries and no in-tab active book to restore and session listing succeeds
- **THEN** the home screen shows empty copy plus create-library and open-library actions, and the document does not grow page-level H/V scrollbars

#### Scenario: Home lists recent libraries

- **WHEN** the user previously opened a library so it is remembered in session state, then opens the app with no in-tab active book to restore
- **THEN** the home screen lists that recent library by its display label

#### Scenario: Home shows error when listing fails

- **WHEN** listing recent libraries fails
- **THEN** the home screen shows an explicit error state with a retry action and does not show the empty-recents copy

#### Scenario: Home waits for restore before interactivity

- **WHEN** the app is still resolving in-tab restore
- **THEN** home actions are not interactive until restore settles

#### Scenario: Home preselects last active library

- **WHEN** session state has a last active library id that is still recent
- **THEN** that library is selected on home without a further click

### Requirement: Home lists books for a selected recent library

Selecting a recent library on the home screen MUST list that library’s books when the remembered handle can be used. When recalling the handle returns `permission-required`, the system MUST show a permission hint and the re-grant control and MUST NOT show a silent empty book list.

#### Scenario: Home lists books for a recent library

- **WHEN** the home screen shows a recent library whose handle is granted and that library contains saved books
- **THEN** those books are listed so the user can choose one

#### Scenario: Permission-required selecting a recent uses re-grant

- **WHEN** the user selects a recent library whose handle recall returns `permission-required`
- **THEN** the books panel shows a permission hint and the re-grant control, not a silent empty book list

### Requirement: Home scrollport containment

The home screen MUST remain viewport-contained (no page-level H/V scroll). When the recent or book list overflows the viewport, scrolling MUST occur only inside a named home scrollport.

#### Scenario: Home overflow stays in named scrollport

- **WHEN** the home recent or book list is longer than the viewport
- **THEN** scrolling occurs only inside the named home scrollport and the document does not grow page-level H/V scrollbars

### Requirement: Open book from home in one click

From the home screen, activating a listed book MUST open that book into the editor in one activation when the library handle is granted. The editor MUST show that book’s gallery and placements. After a successful open, filmstrip and pasteboard MUST be the named editor scrollports. When recall returns `permission-required`, the system MUST remember that book for re-grant and show the re-grant control. A failed open MUST leave recent order unchanged and MUST show a human-readable error on home. Home create, open, grant, and open-book actions MUST be serialized while busy. After a locked-elsewhere failure from home, the home surface MUST clear the locked access phase so later Start editing does not show a lock banner.

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book on the home screen for a recent library with a granted handle
- **THEN** the editor becomes the active surface showing that book’s gallery and placements

#### Scenario: Permission-required opening a book uses re-grant

- **WHEN** the user activates a listed book and handle recall returns `permission-required`
- **THEN** the system remembers that book for re-grant, shows the re-grant control, and the editor does not open an empty silent library

#### Scenario: Failed open does not reorder recents

- **WHEN** opening a book fails because it is locked elsewhere
- **THEN** the home screen shows a human-readable locked message and the recent-libraries order is unchanged

#### Scenario: Locked-elsewhere from home clears on home surface

- **WHEN** opening a book from home fails with locked-elsewhere
- **THEN** the home surface does not keep a locked access phase that would banner Start editing

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

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker in development and e2e builds only. With no library open, create/open actions MUST be available from the home screen (and MAY remain reachable from editor chrome after leaving home). Opening or creating MUST remember the library handle and update the recent-libraries list only after success. When create library runs while a library-backed book is open, the system MUST obtain a picked folder first; cancelling the picker MUST leave the current book open with its lock held. After a successful pick, the system MUST flush pending saves, release the previous book, and start a clean empty book in the new folder without copying the previous book file; the filmstrip MUST reflect the new folder. After a successful create with no active book id and no library-backed book open, the system MUST adopt the current in-memory book so Save can persist it. After a successful open of a library that already contains books, when the editor has no gallery or placements (including after Home cleared the document), the system MUST load a stored book into the editor (preferring a book with content over an empty placeholder) and MUST NOT adopt a document that belonged to another library. When the editor already has unsaved session-only content and no library-backed book is open, open MUST still adopt that work without clearing gallery or placements. Editor create/open/Home actions MUST be disabled or no-op while restore is pending. The shell MUST remain viewport-contained (no page-level H/V scroll; home, filmstrip, and pasteboard stay the named scrollports for their respective surfaces).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open and no in-tab active book to restore
- **THEN** create-library and open-library actions are visible on the home screen and the document does not grow page-level H/V scrollbars

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam in a development or e2e build
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

#### Scenario: Create library adopts in-memory book

- **WHEN** the user creates a library while an in-memory book is already in the editor and no book id is active
- **THEN** that book becomes the active library-backed book without clearing gallery or placements

#### Scenario: Create library while a book is open starts clean

- **WHEN** the user creates a new library while a library-backed book is open in the editor and picks a folder
- **THEN** the previous book is released after the pick, the new folder does not receive a copy of that book, and the editor shows a clean book with the new folder’s photos in the filmstrip

#### Scenario: Create library picker cancel keeps the book

- **WHEN** the user activates New library while a library-backed book is open and cancels the folder picker
- **THEN** the same book remains open with its lock still held and the library binding unchanged

#### Scenario: Open existing library loads stored book

- **WHEN** the user opens a library that already contains a saved book and the editor is empty
- **THEN** the editor shows that book’s gallery and placements without requiring a reload

#### Scenario: Open prefers filled book over empty session book

- **WHEN** the library contains an empty session-book placeholder and another book with gallery content, and the editor is empty
- **THEN** open activates the filled book

#### Scenario: Editor actions wait for restore

- **WHEN** in-tab restore is still pending
- **THEN** editor New library, Open, and Home actions are not interactive

### Requirement: Restore book after reload when handle is granted

After a successful save, when the tab is reloaded and session state can recall a library handle that still has readwrite permission **and** an in-tab active book id is still present, the system SHALL restore the previously active library-backed book so gallery ids and placements match what was saved. When the tab opens without an in-tab active book id, the system MUST show the home screen instead of auto-entering the editor. When restore fails, the system MUST clear stale in-tab and session active ids and library binding and show home. While restore is pending, the editor chrome MUST NOT accept library-switching actions.

#### Scenario: Reload restores saved book

- **WHEN** the user has saved a library-backed book, the tab reloads, and the remembered library handle is still granted with an in-tab active book id present
- **THEN** the editor restores the same book id with the same gallery ids and placements

#### Scenario: Fresh visit shows home with recents

- **WHEN** the user previously used a library so it is recent, then opens the app with no in-tab active book id
- **THEN** the home screen is shown listing that recent library rather than auto-entering the editor

#### Scenario: Failed restore clears stale state

- **WHEN** restore cannot open the in-tab active book
- **THEN** stale active ids and library binding are cleared and the home screen is shown
