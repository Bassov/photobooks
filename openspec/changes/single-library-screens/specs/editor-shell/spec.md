## MODIFIED Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip when the editor surface is active. App surfaces SHALL be one of: unsupported-browser, welcome, library (empty or with books), or editor. When File System Access directory picking is unavailable (or the context is insecure / mobile-only), unsupported-browser MUST be the only surface. When a library handle is granted and no in-tab book is active, library MUST be primary. When no library handle is available (or permission is denied/missing), welcome MUST be primary. The legacy single photo-card success screen and the multi-recent home screen MUST NOT be primary. The shell SHALL fill the viewport without page-level H/V scroll (library, filmstrip, and pasteboard are the named scrollports for their surfaces).

#### Scenario: Shell vs library

- **WHEN** the editor surface is active
- **THEN** workspace and filmstrip regions are visible and the legacy photo-card success screen is not primary

- **WHEN** the app opens with a granted library handle and no in-tab active book
- **THEN** library is the primary surface

### Requirement: Create or open a library folder

The system SHALL let the user choose the single library folder via `showDirectoryPicker({ id: 'photobooks-library', mode: 'readwrite', startIn: 'documents' })` when File System Access is available, with a Chromium FSA test seam in development/e2e builds (not a shipped file-input fallback). Success MUST remember the single handle (replace on change; `isSameEntry` reuses the same library id). Cancel MUST leave the previous library (if any) unchanged. Choose/change library MUST be disabled while restore is pending. Creating a book while the library is open stays on the library/editor flows below — not a second concurrent library.

#### Scenario: Choose library and cancel invariants

- **WHEN** the user chooses or changes the library folder (or cancels the picker)
- **THEN** the outcomes in the requirement hold and the document stays viewport-contained

### Requirement: Permission-required re-grant

On `permission-required` after restore (or mid-session save/autosave), durable access stays incomplete until re-grant. Chrome MUST prefer a one-activation control that calls `requestPermission({mode:'readwrite'})` on the peeked handle (copy: Allow access to \<folder name\>) before offering a new directory picker. Picker re-grant MUST verify `isSameEntry` when a target handle was peeked. Restore-time re-grant resumes the library surface (and last book when an in-tab id exists); mid-session re-grant keeps in-memory edits. Control MUST NOT appear when granted and MUST NOT create page scroll. Permission deny and picker cancel MUST use distinct readable messages.

#### Scenario: One-step re-grant resumes library or book

- **WHEN** restore failed with `permission-required` and the user grants via `requestPermission` (or same-folder picker)
- **THEN** the library surface (or previously active book when restoring an in-tab id) is available again

### Requirement: Leave editor and re-grant from library

A back-to-library control SHALL flush pending saves, release lock, clear in-tab id and session assets, and show the library surface; flush/save-error keeps the editor with a message. After leaving, opening another book MUST NOT leak the previous book file into a different library folder after Change library. Re-grant prefers `requestPermission`, then picker with `isSameEntry`; success continues to library or the pending book; mismatch/deny shows error without silent no-op. When a stored handle cannot be peeked, re-grant MUST refuse binding an arbitrary picked folder as that library. Editor status for typed failures MUST use human-readable text (never raw codes such as `permission-required`).

#### Scenario: Back to library then change library does not leak

- **WHEN** the user leaves via back-to-library then changes to a different folder and opens a book
- **THEN** the editor shows that library’s book and storage has no copy of the previous book

#### Scenario: Peek-failed re-grant refuses bare bind

- **WHEN** re-grant has a stored handle that cannot be peeked and the user picks a folder
- **THEN** the app refuses the bind with a readable error and does not attach that folder as the remembered library

### Requirement: Library identity, titles, and rename

Same-folder choose/change via `isSameEntry` MUST reuse the single library id (no duplicate library records). Display title: non-empty trimmed `title`, else `"Untitled book"` (fallback not written to storage). Rename from library or editor MUST persist `title`; renaming a non-active book MUST NOT replace the active document; cancel leaves title unchanged. Rename MUST stay within frame budget (zero LoAF while filmstrip scrolls). Opening an existing library MUST load stored content, not leave an empty same-id placeholder.

#### Scenario: Untitled fallback and rename persist

- **WHEN** a book has empty title, or the user renames to `"Trip"`
- **THEN** chrome/list show `"Untitled book"` or `"Trip"` respectively, and storage matches the rename without writing the fallback string as title

### Requirement: Save, restore, and hashed previews

Ctrl/Cmd+S (and chrome save) SHALL persist gallery/layout for a library-backed book; typed failures surface as non-blocking status without clearing memory. Reload with granted handle and in-tab active book id SHALL restore that book; without in-tab id but with granted handle, show library; with no usable handle, show welcome or unsupported; failed restore clears stale book state appropriately. After restore/save+reload, thumbnails and placed frames SHALL rehydrate from derived cache when `contentHash` exists (thumb derivative MAY fill a missing zoom tier); landscape crop MUST NOT be square-forced. When gallery assets have durable identity but no live original `File` in session, the editor SHALL surface them via the missing-assets relink flow (pill + dialog) rather than silently treating them as permanently gone.

#### Scenario: Reload restores saved hashed book

- **WHEN** a hashed library-backed book is saved and reloaded with a granted handle and in-tab id
- **THEN** gallery ids, placements, thumbs, and placed frames match the saved durable state

#### Scenario: Missing originals open relink UI

- **WHEN** a restored book has gallery assets with identity/`contentHash` but no live session File for those assets
- **THEN** the missing-assets pill and relink dialog are available and the book stays editable

## ADDED Requirements

### Requirement: Unsupported-browser screen

When `showDirectoryPicker` is not a function, the browsing context is not secure, or the UA is mobile/touch-only (`navigator.userAgentData?.mobile` when available), the system SHALL show a blocking unsupported-browser screen with copy that Photobooks works in desktop Chrome, Edge, or other Chromium browsers (File System Access required). No welcome, library, or editor UI MUST render behind it. Automated tests MUST continue to use File System Access stubs as Chromium doubles and MUST NOT force a non-FSA product fallback.

#### Scenario: Missing directory picker blocks the app

- **WHEN** `showDirectoryPicker` is absent (and tests have not installed an FSA stub)
- **THEN** only the unsupported-browser screen is shown

### Requirement: Welcome screen

With no remembered library handle, or after permission denied/missing with no usable grant path, the system SHALL show a welcome screen that briefly explains the product and offers “Choose library folder”. Activating that control MUST open the library directory picker described above and, on success, remember the handle and enter the library surface.

#### Scenario: Choose folder from welcome

- **WHEN** the user activates Choose library folder and picks a directory
- **THEN** the handle is remembered and the library surface is shown

### Requirement: Library screen (empty and with books)

With a granted library handle and no in-tab active book, the system SHALL show the library surface. When `listBooks()` is empty, it MUST offer a primary Create book action. When books exist, it MUST list them (open on activation), and offer New book, Change library (showing the current folder name as the path), and Settings. Settings MUST open a simple stub dialog (“Settings coming soon”). Library overflow scrolls only in a named library scrollport. Actions MUST serialize while busy. The surface MUST expose one page `h1` and visible `:focus-visible` rings on list controls.

#### Scenario: Empty library offers create

- **WHEN** the granted library has no books
- **THEN** the empty library surface shows Create book and no book list rows

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book with a granted handle
- **THEN** the editor shows that book’s gallery and placements

#### Scenario: Change library updates the folder name

- **WHEN** the user changes the library to another folder successfully
- **THEN** the library surface shows that folder’s name as the current path and lists that folder’s books

#### Scenario: Settings stub

- **WHEN** the user opens Settings from the library surface
- **THEN** a dialog communicates that settings are coming soon and can be dismissed

## REMOVED Requirements

### Requirement: Home screen, books list, and open
