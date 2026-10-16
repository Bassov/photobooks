# Spec Delta

## MODIFIED Requirements

### Requirement: Permission-required defers library restore

When recalling the library handle returns `permission-required`, or when save/autosave fails with `permission-required`, the system MUST leave durable library access incomplete until the user re-grants access. The editor chrome MUST expose a keyboard-reachable control that, in one activation, opens the directory picker so the user can choose the same library folder again. After restore-time re-grant, library-backed editing MUST resume from the last saved book. After mid-session re-grant, the in-memory book MUST be kept and Save MAY retry. The control MUST NOT appear when permission is already granted. The control MUST NOT create page-level horizontal or vertical scroll; filmstrip and pasteboard remain the only named scrollports.

#### Scenario: Permission-required defers restore

- **WHEN** the tab reloads and recalling the library handle returns `permission-required`
- **THEN** the book is not silently loaded from disk and the editor shows a re-grant control

#### Scenario: One-step re-grant resumes editing

- **WHEN** restore failed with `permission-required` and the user activates the re-grant control and picks the same library folder with readwrite access
- **THEN** the previously active library-backed book is restored so gallery ids and placements match what was last saved

#### Scenario: No re-grant control when permission granted

- **WHEN** a library-backed book is open with a granted handle
- **THEN** the re-grant control is not shown

#### Scenario: Mid-session re-grant keeps in-memory edits

- **WHEN** save or autosave fails with `permission-required` and the user activates the re-grant control and picks the library folder with readwrite access
- **THEN** the in-memory book is not replaced from disk and a subsequent save may persist that in-memory document

## ADDED Requirements

### Requirement: Single-writer lock for the active book

When the editor activates a library-backed book (create, open, restore, or adopt), it MUST acquire that book's exclusive session lock and MUST hold it until the book is left or the library is detached. Leaving the book or detaching the library MUST release the lock.

#### Scenario: Activating a book acquires the lock

- **WHEN** the editor successfully activates a library-backed book
- **THEN** that book's session lock is held by this tab

#### Scenario: Leaving the book releases the lock

- **WHEN** the editor leaves the active library-backed book or detaches the library while holding the lock
- **THEN** the lock is released so another tab may acquire it

### Requirement: Locked-elsewhere blocks editing

When acquiring the book lock returns `locked-elsewhere`, the editor MUST NOT activate writable library-backed editing for that book. The chrome MUST show a clear non-blocking message that the book is open in another tab. Save and document mutations for that book MUST remain unavailable. Open library and New book MUST stay reachable so the user can leave the blocked state. The message MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Second tab sees open-in-another-tab message

- **WHEN** one tab already holds the lock for a book and a second tab tries to activate the same library-backed book
- **THEN** the second tab shows a message that the book is open in another tab and does not become a writable library-backed editor for that book

#### Scenario: Locked tab cannot save

- **WHEN** the editor is blocked with `locked-elsewhere` for a book
- **THEN** Save and autosave do not persist that book from this tab

#### Scenario: Different book or new book clears the lock message

- **WHEN** the editor is blocked with `locked-elsewhere` and the user successfully activates a different book or creates a new book that acquires its lock
- **THEN** the open-in-another-tab message is cleared

#### Scenario: Same contended book keeps the lock message

- **WHEN** the editor is blocked with `locked-elsewhere` for a book and the user again tries to activate that same book while another tab still holds the lock
- **THEN** the open-in-another-tab message remains
