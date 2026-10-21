# editor-shell Specification

## Purpose

Editor chrome and home surface: library create/open, book lifecycle (create, save, restore, autosave, locks), titles, and viewport-contained shell layout. Filmstrip gallery behavior lives in `filmstrip`; pasteboard place/camera/template behavior lives in `pasteboard`.

## Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip when the editor surface is active. When the app opens with no in-tab active book to restore, home MUST be primary. The legacy single photo-card success screen MUST NOT be the primary layout. The shell SHALL fill the viewport without page-level H/V scroll (home, filmstrip, and pasteboard are the named scrollports for their surfaces).

#### Scenario: Shell vs home

- **WHEN** the editor surface is active
- **THEN** workspace and filmstrip regions are visible and the legacy photo-card success screen is not primary

- **WHEN** the app opens with no in-tab active book
- **THEN** home is the primary surface

### Requirement: Create or open a library folder

The system SHALL let the user create or open a library via directory picker when File System Access is available, with a test seam in development/e2e builds. Create/open MUST remember the handle and update recents only after success. Create while a library-backed book is open: pick first; cancel keeps the book and lock; success flushes, releases previous book, starts a clean empty book (no copy). Create with no active book id MUST adopt the in-memory book. Open of a library with books into an empty editor MUST load a stored book (prefer contentful). Open with unsaved session-only content MUST adopt without clearing. Create/open/Home MUST be disabled while restore is pending.

#### Scenario: Create, open, and cancel invariants

- **WHEN** the user creates or opens a library (or cancels create while a book is open)
- **THEN** the outcomes in the requirement hold and the document stays viewport-contained

### Requirement: Adopt, upgrade assets, and create book

With a library open and no library-backed book id, the system SHALL adopt the in-memory book without clearing gallery/placements; if the same id exists on disk and the editor is empty, load the stored document. Adopt SHALL write durable identity/`contentHash` for session assets that still have originals. Create book MUST ask for a title before persist; cancel MUST NOT create; whitespace title stores empty (display Untitled). New book becomes active and is persisted under the library layout.

#### Scenario: Adopt then save keeps session work

- **WHEN** the user has session-only edits, creates a library, and saves
- **THEN** gallery and placements persist as the active library-backed book with identity/hash for hydrate

### Requirement: Save, restore, and hashed previews

Ctrl/Cmd+S (and chrome save) SHALL persist gallery/layout for a library-backed book; typed failures surface as non-blocking status without clearing memory. Reload with granted handle and in-tab active book id SHALL restore that book; without in-tab id, show home; failed restore clears stale state and shows home. After restore/save+reload, thumbnails and placed frames SHALL rehydrate from derived cache when `contentHash` exists (thumb derivative MAY fill a missing zoom tier); landscape crop MUST NOT be square-forced. When gallery assets have durable identity but no live original `File` in session, the editor SHALL surface them via the missing-assets relink flow (pill + dialog) rather than silently treating them as permanently gone.

#### Scenario: Reload restores saved hashed book

- **WHEN** a hashed library-backed book is saved and reloaded with a granted handle and in-tab id
- **THEN** gallery ids, placements, thumbs, and placed frames match the saved durable state

#### Scenario: Missing originals open relink UI

- **WHEN** a restored book has gallery assets with identity/`contentHash` but no live session File for those assets
- **THEN** the missing-assets pill and relink dialog are available and the book stays editable

### Requirement: Missing-assets relink

The editor SHALL list gallery assets that are `missing` or `modified` relative to a scanned source root and offer Rescan folder (worker scan + worker hash + pure `matchAssets`). Progress MUST be batched per animation frame. Resolve SHALL apply matched identity patches and reattach Files; Skip for now SHALL dismiss the dialog without clearing the pill while problems remain. Hash mismatch MUST NOT silently substitute a different file. Scrolling during rescan MUST stay inside named scrollports (relink list, filmstrip, pasteboard); no page-level H/V scroll. Per-row Locate… and Use new version are out of scope for this slice.

#### Scenario: Rescan restores by content hash

- **WHEN** the user rescans a folder that contains the same bytes under a new path and confirms Resolve
- **THEN** matched assets regain live Files and identity paths, and placed frames show the photos again with crops kept

#### Scenario: Skip keeps hatched problems

- **WHEN** the user chooses Skip for now while assets are still missing
- **THEN** the dialog closes, the missing pill remains, and the book stays editable

#### Scenario: Filmstrip stays responsive during rescan

- **WHEN** a rescan is running and the user scrolls the filmstrip
- **THEN** scrolling occurs only inside the filmstrip scrollport and produces zero LoAF entries for that interaction

### Requirement: Permission-required re-grant

On `permission-required` (restore or mid-session save/autosave), durable access stays incomplete until re-grant. Chrome MUST expose a one-activation control that opens the directory picker for the same folder. Restore-time re-grant resumes the last saved book; mid-session re-grant keeps in-memory edits. Control MUST NOT appear when granted and MUST NOT create page scroll.

#### Scenario: One-step re-grant resumes editing

- **WHEN** restore failed with `permission-required` and the user re-grants the same folder
- **THEN** the previously active book is restored

### Requirement: Library-backed import, autosave, and save indicator

Library-backed import MUST register a source root and write identity fields; session-only import without a library MAY stay session-only. Dirty library-backed books SHALL autosave after idle debounce (reuse durable save path; MUST NOT start during drag/zoom). Chrome SHALL show clean / pending / saving / error indicator without page scroll.

#### Scenario: Idle edit autosaves; gesture waits

- **WHEN** the user edits then idles (no gesture)
- **THEN** storage holds the update; if a gesture spans the debounce, autosave waits until it ends

### Requirement: Single-writer lock and locked-elsewhere

Activating a library-backed book MUST acquire its exclusive session lock until leave/detach. On `locked-elsewhere`, the tab MUST NOT become writable for that book; show a clear message; Save/mutations unavailable; Open library / New book remain reachable. Message MUST NOT create page scroll.

#### Scenario: Second tab blocked

- **WHEN** one tab holds the lock and another activates the same book
- **THEN** the second tab shows open-in-another-tab and cannot save that book

### Requirement: Home screen, books list, and open

With no in-tab book to restore, home SHALL list recent libraries (preselect last active when still recent), offer create/open, show loading until restore settles, and show explicit error+retry on listing failure. Selecting a recent library lists books by display title; `permission-required` shows hint + re-grant (not silent empty). Home overflow scrolls only in a named home scrollport. One activation opens a listed book when granted; remember book + re-grant on permission-required; failed open leaves recent order unchanged and clears locked access phase on home. Home actions MUST serialize while busy. Home MUST expose one page `h1`, visible `:focus-visible` rings on list controls, and a polite live announcement when the selected recent library changes; while busy, focus MUST remain on the control that started the action. Headings MUST NOT carry redundant ARIA roles/labels.

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book with a granted handle
- **THEN** the editor shows that book’s gallery and placements

#### Scenario: Selected library is announced

- **WHEN** the user selects a recent library on home
- **THEN** a polite live region announces that library’s label and focus stays on the selected control unless the user moves it

### Requirement: Leave editor and re-grant from home

Home control SHALL flush pending saves, release lock, clear in-tab id and session assets, and show home; flush/save-error keeps the editor with a message. After Home, another library MUST NOT receive the previous book file. Re-grant from home prefers `requestPermission`, then picker with `isSameEntry` check; success opens the pending book; mismatch/deny shows error without silent no-op. Permission deny and picker cancel MUST use distinct readable messages. When a target library id is known but peek fails, re-grant MUST refuse binding an arbitrary picked folder. Editor status for typed failures MUST use human-readable text (never raw codes such as `permission-required`).

#### Scenario: Home then other library does not leak

- **WHEN** the user leaves via Home then opens a different library
- **THEN** the editor shows that library’s book and storage has no copy of the previous book

#### Scenario: Peek-failed re-grant refuses bare bind

- **WHEN** re-grant has a target library id whose stored handle cannot be peeked and the user picks a folder
- **THEN** the app refuses the bind with a readable error and does not attach that folder as the target library

### Requirement: Library identity, titles, and rename

Same-folder create/open via `isSameEntry` MUST reuse the library id (no duplicate recent). Display title: non-empty trimmed `title`, else `"Untitled book"` (fallback not written to storage). Rename from home or editor MUST persist `title`; renaming a non-active book MUST NOT replace the active document; cancel leaves title unchanged. Rename MUST stay within frame budget (zero LoAF while filmstrip scrolls). Opening an existing library MUST load stored content, not leave an empty same-id placeholder.

#### Scenario: Untitled fallback and rename persist

- **WHEN** a book has empty title, or the user renames to `"Trip"`
- **THEN** chrome/list show `"Untitled book"` or `"Trip"` respectively, and storage matches the rename without writing the fallback string as title

### Requirement: Empty editor and first placement guidance

When the book gallery is empty, the pasteboard SHALL show an EmptyState card titled "Start with your photos" with a short description and keyboard-reachable primary "Add folder…" and secondary "Add photos…" actions that use the same import path as the editor top bar. When the gallery has photos and no frame has an `assetId`, the pasteboard SHALL show a non-blocking placement hint ("Drag a photo onto a frame, or click a photo and then a frame.") that does not intercept frame hit targets (`pointer-events: none` except card action buttons). The hint SHALL disappear when any frame gains an `assetId` and MUST NOT appear when the book already has placements. An import that adds zero gallery photos while the gallery remains empty SHALL keep the empty card and MAY show a secondary line "No photos found in that folder". The placement hint SHALL announce itself through a polite live region on the pasteboard and MUST NOT overwrite the shared editor-status line (restore / unplace / save). This guidance is in-editor only; first-run onboarding (sample book / tour) is out of scope and MUST reuse this card later rather than add a second empty state.

#### Scenario: Empty gallery shows import card

- **WHEN** the editor is open and `book.gallery` is empty
- **THEN** the pasteboard EmptyState card is visible with Add folder… and Add photos… actions that open the shared import path

#### Scenario: Placement hint until first place

- **WHEN** the gallery has at least one photo and no frame has an `assetId`
- **THEN** the placement hint is visible as a polite live region and the shared editor-status line is left for transient chrome messages

#### Scenario: Hint clears on first placement

- **WHEN** any frame receives an `assetId` (or the book already has placements on load)
- **THEN** the placement hint is not shown

### Requirement: Import errors panel

Per-file import failures SHALL carry a stable `id`, a `reason` (`unsupported-type` | `heic` | `decode-failed`), and optional `assetId` when a gallery asset was attempted. Errors from successive imports SHALL append to a session import-errors store (dismiss by id, clear all); a new import MUST NOT wipe unrelated errors. The editor SHALL present errors in a dismissable panel (not as an alert list), openable from the import-error toast action "Show files" and from the filmstrip status when errors remain. Entries SHALL group by reason with counts and file names; each entry has a labelled dismiss control; the panel offers Clear all. New errors SHALL be announced once via polite Status. Focus SHALL return to the opening control when the panel closes.

#### Scenario: Group, dismiss, clear, and jump

- **WHEN** the user imports a batch that yields unsupported and decode failures, opens the panel from "Show files" or filmstrip status, dismisses one entry, then clears all, and activates a linked entry whose `assetId` is still in the gallery
- **THEN** groups show correct reason counts, dismiss and Clear all remove entries from the store, the linked entry scrolls the filmstrip to that tile with selection set, and entries without a gallery tile show they were not imported
