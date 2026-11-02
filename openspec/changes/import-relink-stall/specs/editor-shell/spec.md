## MODIFIED Requirements

### Requirement: One durable photo folder per book

A book SHALL have at most one photo source root. Choosing a folder MUST keep the `FileSystemDirectoryHandle`, persist it in IndexedDB keyed by `sourceRootId` (separate store from library handles) after the first yielded import batch (not only after the full folder finishes), register that root with the FSA asset-source adapter, and write `sourceRootId` + `relativePath` (and size/mtime/hash as available) on imported assets. If that IndexedDB write fails, the import MUST still attach every file of the folder, keep the root bound for the session, and show a status that the folder must be added again after reload. Change photo folder… MUST confirm, then replace the book's photo root (prior root association and gallery assets from that root are cleared) rather than adding a second root. Product UI MUST NOT use `showOpenFilePicker` or hidden file inputs for import.

#### Scenario: Pick persists handle and identity

- **WHEN** the user chooses a photo folder for a book and the first import batch has yielded
- **THEN** the directory handle is stored under the book's `sourceRootId` and imported assets carry that root id plus relative paths

#### Scenario: Change replaces the root

- **WHEN** the book already has a photo folder and the user confirms Change photo folder… then picks another folder
- **THEN** the book is bound to the new root only (one `sourceRootId`) and prior gallery assets from the old root are removed
