## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: One durable photo folder per book

A book SHALL have at most one photo source root. Choosing a folder MUST keep the `FileSystemDirectoryHandle`, persist it in IndexedDB keyed by `sourceRootId` (separate store from library handles), register that root with the FSA asset-source adapter, and write `sourceRootId` + `relativePath` (and size/mtime/hash as available) on imported assets. Change photo folder… MUST confirm, then replace the book's photo root (prior root association and gallery assets from that root are cleared) rather than adding a second root. Product UI MUST NOT use `showOpenFilePicker` or hidden file inputs for import.

#### Scenario: Pick persists handle and identity

- **WHEN** the user chooses a photo folder for a book
- **THEN** the directory handle is stored under a `sourceRootId`, assets from the scan carry that id and relative paths, and originals resolve via the handle without retaining File as the durability story

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
