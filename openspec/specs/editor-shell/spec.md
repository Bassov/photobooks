# editor-shell Specification

## Purpose

Editor chrome and library surfaces: unsupported/welcome/library/editor, single-library choose/change, book lifecycle (create, save, restore, autosave, locks), titles, and viewport-contained shell layout. Filmstrip gallery behavior lives in `filmstrip`; pasteboard place/camera/template behavior lives in `pasteboard`.

## Requirements

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

### Requirement: Adopt, upgrade assets, and create book

With a library open and no library-backed book id, the system SHALL adopt the in-memory book without clearing gallery/placements; if the same id exists on disk and the editor is empty, load the stored document. Adopt SHALL write durable identity (path/size/mtime/root) for session assets that still have originals so DerivedCache can key by identity digest. Create book MUST ask for a title before persist; cancel MUST NOT create; whitespace title stores empty (display Untitled). New book becomes active and is persisted under the library layout.

#### Scenario: Adopt then save keeps session work

- **WHEN** the user has session-only edits, creates a library, and saves
- **THEN** gallery and placements persist as the active library-backed book with identity for hydrate

### Requirement: Save, restore, and identity-keyed previews

Ctrl/Cmd+S (and chrome save) SHALL persist gallery/layout for a library-backed book; typed failures surface as non-blocking status without clearing memory. Reload with granted handle and in-tab active book id SHALL restore that book; without in-tab id but with granted handle, show library; with no usable handle, show welcome or unsupported; failed restore clears stale book state appropriately. After restore/save+reload, thumbnails and placed frames SHALL rehydrate from derived cache when durable identity is complete (thumb derivative MAY fill a missing zoom tier); landscape crop MUST NOT be square-forced. Books that only have legacy `contentHash`-keyed cache rows MAY miss once and regenerate. When gallery assets have durable identity but no live original `File` in session, the editor SHALL surface them via the missing-assets relink flow (pill + dialog) rather than silently treating them as permanently gone.

#### Scenario: Reload restores saved identity-keyed book

- **WHEN** an identity-complete library-backed book is saved and reloaded with a granted handle and in-tab id
- **THEN** gallery ids, placements, thumbs, and placed frames match the saved durable state without requiring `hashContent`

#### Scenario: Missing originals open relink UI

- **WHEN** a restored book has gallery assets with durable identity but no live session File for those assets
- **THEN** the missing-assets pill and relink dialog are available and the book stays editable

### Requirement: Missing-assets relink

The editor SHALL list gallery assets that are `missing` or `modified` relative to a scanned source root and offer Rescan folder (cheap worker scan + pure `matchAssets` on path/size/mtime). Progress MUST be batched per animation frame. Resolve SHALL apply matched identity patches and reattach Files; Skip for now SHALL dismiss the dialog without clearing the pill while problems remain. Metadata mismatch MUST NOT silently substitute a different file. Scrolling during rescan MUST stay inside named scrollports (relink list, filmstrip, pasteboard); no page-level H/V scroll. Per-row Locate… and Use new version are out of scope for this slice. While a photo-folder import (including list-first placeholder enqueue through multi-batch File attach) is in progress for the active book, the editor MUST NOT open the missing-assets dialog or show the missing pill for gallery placeholders that are still awaiting session Files from that import.

#### Scenario: Rescan restores by path metadata

- **WHEN** the user rescans a folder that contains the same relative paths with matching size and mtime and confirms Resolve
- **THEN** matched assets regain live Files and identity paths, and placed frames show the photos again with crops kept

#### Scenario: Skip keeps hatched problems

- **WHEN** the user chooses Skip for now while assets are still missing
- **THEN** the dialog closes and the missing pill remains while the book stays editable

#### Scenario: Active folder import does not open missing UI

- **WHEN** the user imports a photo folder into a book and list-first gallery placeholders exist before every File is attached
- **THEN** the missing-assets dialog and missing pill stay closed for the duration of that import; progress remains on the import bar only

### Requirement: Permission-required re-grant

On `permission-required` after restore or mid-session save, durable access stays incomplete until re-grant. Chrome MUST prefer one-activation `requestPermission({mode:'readwrite'})` on the peeked handle before a new directory picker. Picker re-grant MUST verify `isSameEntry` when peeked. Restore-time re-grant resumes the library (and last book when an in-tab id exists); mid-session keeps in-memory edits. Hide when granted; no page scroll; distinct messages for deny vs cancel.

#### Scenario: One-step re-grant resumes library or book

- **WHEN** restore failed with `permission-required` and the user grants via `requestPermission` (or same-folder picker)
- **THEN** the library surface (or previously active book when restoring an in-tab id) is available again

### Requirement: Library-backed import, autosave, and save indicator

Library-backed import MUST register a source root and write identity fields (path/size/mtime); session-only import without a library MAY stay session-only. Dirty library-backed books SHALL autosave after idle debounce (reuse durable save path; MUST NOT start during drag/zoom). During an active photo-folder import, progressive gallery/asset flushes MUST be durable enough that a mid-import reload can restore already-imported gallery ids (and book placements) from library book JSON without waiting for content hashes. The photo-folder handle MUST be remembered in IndexedDB after the first yielded import batch. Chrome SHALL show clean / pending / saving / error indicator without page scroll.

#### Scenario: Idle edit autosaves; gesture waits

- **WHEN** the user edits then idles (no gesture)
- **THEN** storage holds the update; if a gesture spans the debounce, autosave waits until it ends

#### Scenario: Mid-import reload restores partial gallery

- **WHEN** a library-backed folder import reloads after flushing some assets
- **THEN** those gallery ids restore immediately and photo-root restore can continue background import

### Requirement: Single-writer lock and locked-elsewhere

Activating a library-backed book MUST acquire its exclusive session lock until leave/detach. On `locked-elsewhere`, the tab MUST NOT become writable for that book; show a clear message; Save/mutations unavailable; library / New book remain reachable. Message MUST NOT create page scroll.

#### Scenario: Second tab blocked

- **WHEN** one tab holds the lock and another activates the same book
- **THEN** the second tab shows open-in-another-tab and cannot save that book

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

### Requirement: Unsupported-browser screen

When `showDirectoryPicker` is not a function, the browsing context is not secure, the page is not a top-level window (`self !== top`), or the UA is mobile (`navigator.userAgentData?.mobile` when available), the system SHALL show a blocking unsupported-browser screen before IndexedDB restore or permission prompts. Detection MUST be feature-based (not UA alone); Chromium `userAgentData.brands` MAY name the browser in copy and choose the Chromium-API-off variant. The screen MUST match kit unsupported copy and CTAs for its variant (`other` / `no-api` / `mobile`): Get Google Chrome and/or other Chromium browser links (noopener), Copy link (share URL), and on `no-api` a Reload control plus turn-on tips — MUST NOT offer “continue anyway”. Overflow scrolls only inside the named `unsupported-scroll` scrollport (no page-level H/V scroll). No welcome, library, or editor UI MUST render behind it. Automated tests MUST continue to use File System Access stubs as Chromium doubles and MUST NOT force a non-FSA product fallback.

#### Scenario: Missing directory picker blocks the app

- **WHEN** `showDirectoryPicker` is absent (and tests have not installed an FSA stub)
- **THEN** only the unsupported-browser screen is shown with kit CTAs (Get Google Chrome visible) and no welcome/library/editor

#### Scenario: Mobile UA shows desktop-required copy

- **WHEN** `navigator.userAgentData.mobile` is true
- **THEN** the unsupported-browser screen uses the mobile variant (desktop required + Copy link) and blocks other surfaces

### Requirement: Welcome screen

With no remembered library handle, or after permission denied/missing with no usable grant path, the system SHALL show a welcome screen matching kit first-run chrome (hero photo, Photobooks mark, primary **Create Library**). Activating Create Library MUST open the library directory picker described above and, on success, remember the handle and enter the library surface. Cancel MUST return to Welcome unchanged. The screen MUST show a plain CC BY-SA photo caption (no capsule) for the hero. Restore-pending, permission-required regrant, and homeError status MUST remain reachable on this surface.

#### Scenario: Choose folder from welcome

- **WHEN** the user activates Create Library and picks a directory
- **THEN** the handle is remembered and the library surface is shown

#### Scenario: Welcome chrome and credit

- **WHEN** Welcome is primary with no restore/regrant overlay
- **THEN** Create Library is the primary action and a plain `screen-credit` caption is visible without a capsule

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

### Requirement: Empty editor and first placement guidance

When the book gallery is empty, the pasteboard SHALL show an EmptyState card titled "Start with your photos" with a short description and a keyboard-reachable primary "Choose photo folder…" action (label "Change photo folder…" when the book already has a photo folder) that uses the same import path as the editor top bar. There MUST NOT be an Add photos… action. When the gallery has photos and no frame has an `assetId`, the pasteboard SHALL show a non-blocking placement hint ("Drag a photo onto a frame, or click a photo and then a frame.") that does not intercept frame hit targets (`pointer-events: none` except card action buttons). The hint SHALL disappear when any frame gains an `assetId` and MUST NOT appear when the book already has placements. An import that adds zero gallery photos while the gallery remains empty SHALL keep the empty card and MAY show a secondary line "No photos found in that folder". The placement hint SHALL announce itself through a polite live region on the pasteboard and MUST NOT overwrite the shared editor-status line (restore / unplace / save). This guidance is in-editor only; first-run onboarding (sample book / tour) is out of scope and MUST reuse this card later rather than add a second empty state.

#### Scenario: Empty gallery shows import card

- **WHEN** the editor is open and `book.gallery` is empty
- **THEN** the pasteboard EmptyState card is visible with Choose photo folder… (or Change photo folder…) and no Add photos… action

#### Scenario: Placement hint until first place

- **WHEN** the gallery has at least one photo and no frame has an `assetId`
- **THEN** the placement hint is visible as a polite live region and the shared editor-status line is left for transient chrome messages

#### Scenario: Hint clears on first placement

- **WHEN** any frame gains an `assetId`
- **THEN** the placement hint is no longer shown

### Requirement: One durable photo folder per book

A book SHALL have at most one photo source root. Choosing a folder MUST keep the `FileSystemDirectoryHandle`, persist it in IndexedDB keyed by `sourceRootId` (separate store from library handles) after the first yielded import batch (not only after the full folder finishes), register that root with the FSA asset-source adapter, and write `sourceRootId` + `relativePath` (and size/mtime/hash as available) on imported assets. Change photo folder… MUST confirm, then replace the book's photo root (prior root association and gallery assets from that root are cleared) rather than adding a second root. Product UI MUST NOT use `showOpenFilePicker` or hidden file inputs for import.

#### Scenario: Pick persists handle and identity

- **WHEN** the user chooses a photo folder for a book and the first import batch has yielded
- **THEN** the directory handle is stored under the book's `sourceRootId` and imported assets carry that root id plus relative paths

#### Scenario: Change replaces the root

- **WHEN** the book already has a photo folder and the user confirms Change photo folder… then picks another folder
- **THEN** the book is bound to the new root only (one `sourceRootId`) and prior gallery assets from the old root are removed

### Requirement: Photo-folder permission re-grant

After reload, the editor SHALL restore the book's photo-folder handle and call `queryPermission({ mode: 'read' })`. When granted, originals resolve with no picker. When the permission state is `prompt`, chrome MUST expose one activation control ("Allow access to \<folder\>") that calls `requestPermission({ mode: 'read' })` before offering a new directory picker. Denied or missing handles MUST fall through to the existing missing-assets / relink UX. This control is distinct from library `readwrite` re-grant.

#### Scenario: Granted photo root needs no picker

- **WHEN** a book with a stored photo-folder handle reloads and `queryPermission` is `granted`
- **THEN** originals resolve via handle and relative path without showing a directory picker

#### Scenario: One-click photo re-grant

- **WHEN** restore finds `prompt` for the photo folder and the user activates Allow access to \<folder\>
- **THEN** the system calls `requestPermission({ mode: 'read' })` and, when granted, resumes resolving originals

### Requirement: Import errors panel

Per-file import failures SHALL carry a stable `id`, a `reason` (`unsupported-type` | `heic` | `decode-failed`), and optional `assetId` when a gallery asset was attempted. Errors from successive imports SHALL append to a session import-errors store (dismiss by id, clear all); a new import MUST NOT wipe unrelated errors. The editor SHALL present errors in a dismissable panel (not as an alert list), openable from the import-error toast action "Show files" and from the filmstrip status when errors remain. Entries SHALL group by reason with counts and file names; each entry has a labelled dismiss control; the panel offers Clear all. The import-error toast description MUST list each failed file with that file’s own message (not a single shared message from the first failure); when a file’s message is empty, the toast MAY list the file name alone. New errors SHALL be announced once via polite Status. Focus SHALL return to the opening control when the panel closes. When a gallery placeholder was enqueued for an asset whose decode later fails, the system MUST remove that placeholder from the gallery so no blank tile remains to select or place; the error entry MAY keep `assetId` for panel grouping but MUST treat the asset as not imported. Folder-import skips of non-image files MUST NOT create import-errors entries; those skips SHALL use a separate polite editor-status summary only.

#### Scenario: Group, dismiss, clear, and not-imported decode

- **WHEN** the user imports a batch that yields unsupported and decode failures, opens the panel from "Show files" or filmstrip status, dismisses one unsupported entry, then clears all
- **THEN** groups show correct reason counts, dismiss and Clear all remove entries from the store, and decode-failed entries whose gallery tile was removed show they were not imported (no jump control)

#### Scenario: Failed decode removes placeholder tile

- **WHEN** an accepted file is enqueued as a filmstrip placeholder and its decode then fails
- **THEN** that placeholder is removed from the gallery, the gallery photo count excludes it, and it cannot be selected or placed

#### Scenario: Folder non-image skips stay out of import-errors

- **WHEN** a folder import skips non-image files and has no per-file import failures
- **THEN** import-errors remains empty and editor-status announces the skipped-file summary

#### Scenario: Toast lists each file with its own message

- **WHEN** a batch yields import failures with different per-file messages (for example HEIC then decode-failed)
- **THEN** the import-error toast description includes each file name with that file’s own message, and MUST NOT reuse the first failure’s message for later files

### Requirement: Folder import and re-scan progress indicator

While a photo-folder first import or post-reload prioritized re-scan is running, the editor SHALL show a simple placeholder progress indicator (reuse existing Status / ProgressBar primitives) with stable test ids so a later visual redesign can restyle without changing observables. Progress MUST update incrementally as batches complete. Styling MAY be minimal; behavior and testids are the contract.

#### Scenario: Import progress advances during folder import

- **WHEN** a folder import is in progress
- **THEN** an element with `data-testid="import-progress"` reports completed/total (or equivalent scanning copy) and updates as batches finish

#### Scenario: Re-scan progress is observable

- **WHEN** a post-reload photo-root re-scan is running
- **THEN** a progress indicator with a stable test id is visible until prioritized work finishes (lazy remainder MAY keep a quieter status or the same indicator)
