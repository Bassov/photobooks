# Spec Delta

## ADDED Requirements

### Requirement: Create or open a library folder

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker. With no library open, chrome MUST offer create/open actions. Opening or creating MUST remember the library handle in session state for later restore. The shell MUST remain viewport-contained (no page-level H/V scroll; filmstrip and pasteboard stay the named scrollports).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open
- **THEN** create-library and open-library actions are visible and the filmstrip and pasteboard remain the only scrollports

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

### Requirement: Create a book in the open library

When a library is open, the system SHALL let the user create a book. The new book MUST become the active editor document and MUST be persisted under the library's book layout on create.

#### Scenario: Create book becomes active

- **WHEN** the user creates a book in an open library
- **THEN** the editor shows that book as the active document and a subsequent load of the same book id from library storage returns the created gallery and layout

### Requirement: Save book with keyboard shortcut

When a library-backed book is active, the system SHALL save the current book document on Ctrl/Cmd+S (and an equivalent chrome save action). Save MUST persist gallery and layout to library storage. Typed failures (`permission-required`, `locked-elsewhere`, and other storage failure codes) MUST surface as non-blocking status text without clearing the in-memory book.

#### Scenario: Ctrl/Cmd+S persists gallery and layout

- **WHEN** the user edits gallery or layout on a library-backed book and presses Ctrl/Cmd+S
- **THEN** library storage holds the updated gallery and layout for that book id

#### Scenario: Save failure shows status

- **WHEN** save returns a typed failure such as `permission-required` or `locked-elsewhere`
- **THEN** a non-blocking status message is shown and the in-memory book is unchanged

### Requirement: Restore book after reload when handle is granted

After a successful save, when the tab is reloaded and session state can recall a library handle that still has readwrite permission, the system SHALL restore the previously active library-backed book so gallery ids and placements match what was saved.

#### Scenario: Reload restores saved book

- **WHEN** the user has saved a library-backed book, the tab reloads, and the remembered library handle is still granted
- **THEN** the editor restores the same book id with the same gallery ids and placements

### Requirement: Hashed previews rehydrate after restore

After restore, thumbnail and tier previews MUST rehydrate from the derived cache when asset `contentHash` values are present. Reattaching live photo-folder originals is out of scope for this capability.

#### Scenario: Hashed previews rehydrate after restore

- **WHEN** a restored book’s assets include `contentHash` values and derived-cache entries exist for those hashes
- **THEN** filmstrip thumbnails (and zoom tiers when requested) hydrate without requiring photo-folder reattachment

### Requirement: Permission-required defers library restore

When recalling the library handle returns `permission-required`, the system MUST leave restore incomplete until the user opens the same folder again via the picker. Full re-grant UX is out of scope.

#### Scenario: Permission-required defers restore

- **WHEN** the tab reloads and recalling the library handle returns `permission-required`
- **THEN** the book is not silently loaded from disk and the user can open the library folder again via the picker

### Requirement: Library-backed import registers source roots

When the active book is library-backed, importing a folder or files MUST register a source root for those originals and MUST write asset identity fields (`sourceRootId`, `relativePath`, and hash-related fields once available) onto gallery assets so the book can reopen against those roots. Session-only File maps MAY remain for in-session decode. Import without an open library MAY keep today's session-only behavior.

#### Scenario: Folder import registers a source root

- **WHEN** the user imports a folder into a library-backed book
- **THEN** a source root is registered for that folder and gallery assets from that import carry `sourceRootId` and `relativePath`

#### Scenario: Import without library stays session-only

- **WHEN** the user imports files with no library open
- **THEN** assets still appear in the filmstrip without requiring source-root registration
