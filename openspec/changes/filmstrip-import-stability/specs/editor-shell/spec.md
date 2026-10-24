## MODIFIED Requirements

### Requirement: Library-backed import, autosave, and save indicator

While a library-backed book is open, gallery and layout edits SHALL mark the session dirty and arm autosave. During an active photo-folder import, progressive gallery/asset flushes MUST be durable enough that a mid-import reload can restore already-imported gallery ids (and book placements) from library book JSON without waiting for every in-flight content hash. The photo-folder handle MUST be remembered in IndexedDB after the first yielded import batch (import may keep using `persist: false` only for the initial bind/paint window). Save indicator phases stay as today.

#### Scenario: Mid-import reload restores partial gallery

- **WHEN** a library-backed folder import has flushed some assets (and optionally placements) and the tab reloads before import finishes
- **THEN** the restored book shows those gallery ids immediately and photo-root restore can continue background import/re-scan

### Requirement: One durable photo folder per book

A book SHALL have at most one photo source root. Choosing a folder MUST keep the `FileSystemDirectoryHandle`, persist it in IndexedDB keyed by `sourceRootId` (separate store from library handles) after the first yielded import batch (not only after the full folder finishes), register that root with the FSA asset-source adapter, and write `sourceRootId` + `relativePath` (and size/mtime/hash as available) on imported assets. Change photo folder… MUST confirm, then replace the book's photo root (prior root association and gallery assets from that root are cleared) rather than adding a second root. Product UI MUST NOT use `showOpenFilePicker` or hidden file inputs for import.

#### Scenario: Pick persists handle and identity

- **WHEN** the user chooses a photo folder for a book and the first import batch has yielded
- **THEN** the directory handle is stored under the book's `sourceRootId` and imported assets carry that root id plus relative paths
