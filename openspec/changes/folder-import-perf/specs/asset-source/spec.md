## ADDED Requirements

### Requirement: Batched folder import without main-thread full walk

First photo-folder import MUST NOT collect or hash the entire directory tree in one synchronous main-thread pass. After the directory handle is obtained, the system SHALL discover entries via worker `scanRoot` (or equivalent off-main-thread walk) and process files in bounded batches with yields so the UI can paint incremental progress. Resolving `File` / hashing / decode for an entry MAY happen per batch; the picker path MUST NOT await a complete in-memory `File[]` for the whole tree before starting progressive import.

#### Scenario: Large folder import stays interruptible

- **WHEN** the user picks a photo folder containing thousands of image files
- **THEN** import progress updates incrementally and the main thread is not blocked by a single full-tree collect or hash before the first progress paint

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL verify / re-hash used-in-book files before remaining folder entries. Priority order MUST be: (1) placed assets on the open book’s visible spread, (2) other assets of the open book for that `sourceRootId`, (3) asset refs from other library books matching the same `sourceRootId` and `relativePath`. Remaining scanned files MUST be processed lazily (idle-time, cancellable) and MUST NOT be required to follow directory enumeration order. Size/mtime hash fast path remains in force for unchanged entries.

#### Scenario: Used-in-book files finish before lazy remainder

- **WHEN** a restored root has both placed open-book assets and many unused files
- **THEN** verify/re-hash of the prioritized used-in-book set completes before idle processing of the unused remainder begins

#### Scenario: Visible spread is highest priority

- **WHEN** the open book has placed assets on the visible spread and other placed assets on non-visible spreads
- **THEN** visible-spread placed assets are verified before other open-book assets for that root

#### Scenario: Lazy remainder is cancellable

- **WHEN** idle re-scan of unused files is running and the user changes folder or tears down the session
- **THEN** pending lazy work is cancelled and MUST NOT continue hashing after cancel

## MODIFIED Requirements

### Requirement: Worker folder scan

`AssetSource.scanRoot` SHALL walk the registered source root's folder tree inside a Web Worker. The walk MUST NOT run as blocking work on the main thread. Domain `scanRoot` results MUST remain typed domain entries without exposing filesystem handles on the domain API. Callers that import or re-scan a photo folder MUST use this (or equivalent batched off-main-thread discovery) rather than a main-thread full-tree `File` collect as the primary discovery path.

#### Scenario: Scan walk runs in a worker

- **WHEN** a caller invokes `scanRoot` on a registered root with readable entries
- **THEN** the directory walk executes in a Web Worker and the caller receives domain `ScannedEntry` values (relative path, byte size, mtime)

#### Scenario: Scan failure stays typed

- **WHEN** the worker cannot complete the walk because permission is required or the root is unreadable
- **THEN** `scanRoot` fails with the corresponding typed code (`permission-required` or `corrupted` / `not-found`) and MUST NOT silently fall back to a main-thread walk

#### Scenario: Import discovery uses worker scan

- **WHEN** the editor starts a first import from a picked photo-folder handle
- **THEN** entry discovery goes through worker `scanRoot` (or equivalent off-main-thread walk) rather than awaiting a complete main-thread `File[]` for the whole tree first
