# asset-source Specification

## Purpose

Defines the domain contract for reading photo-folder originals, scanning source roots, computing content hashes off the main thread, and purely matching scanned files to book asset records for later open/save and relink flows.

## Requirements

### Requirement: Domain asset source API

The system SHALL expose a domain asset-source API that registers read-only source roots, lists scanned file entries for a root, and resolves an entry for hashing or identity updates using domain types only. The API MUST NOT accept or return filesystem handles. Relative paths MAY appear as domain strings that match asset-record `relativePath` values.

#### Scenario: Scan returns domain entries

- **WHEN** a source root is registered and scanned
- **THEN** the result lists entries with relative path, byte size, and mtime as domain fields without exposing a directory handle

#### Scenario: Handles stay off the domain API

- **WHEN** a caller uses only the domain asset-source API
- **THEN** no method parameter or return value is a File System Access directory or file handle

### Requirement: Persist photo source-root handles outside the domain API

The system SHALL persist File System Access directory handles for photo source roots in IndexedDB, keyed by `sourceRootId`, in a store separate from library handles. The domain asset-source API MUST remain handle-free: session/editor code remembers and recalls handles, then registers an FSA adapter root for scanning and `getFile` by relative path. Permission checks for photo roots MUST use `mode: 'read'` (`queryPermission` / `requestPermission`). Clearing site data or a missing folder MUST surface as typed `not-found` / `permission-required` for callers.

#### Scenario: Remembered root survives reload when granted

- **WHEN** a photo-folder handle was stored for a `sourceRootId` and later recalled with `read` permission granted
- **THEN** the FSA adapter can scan and resolve entries for that root without a new directory picker

#### Scenario: Domain API stays handle-free

- **WHEN** a caller uses only the domain asset-source API after a photo root is registered from a recalled handle
- **THEN** no method parameter or return value is a File System Access directory or file handle

### Requirement: Typed asset source results

Asset-source operations SHALL return typed success or failure results. Failure codes MUST include at least `permission-required`, `not-found`, and `corrupted`. Callers MUST distinguish these codes without inspecting thrown platform errors.

#### Scenario: Missing root fails typed

- **WHEN** the caller scans or resolves against an unknown source root id
- **THEN** the operation fails with `not-found`

#### Scenario: Permission failure is typed

- **WHEN** the adapter cannot access a registered root because permission is required
- **THEN** the operation fails with `permission-required`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory asset-source adapter and a File System Access asset-source adapter. Both MUST pass one shared contract-test suite that exercises the domain API and every named failure code. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes contract suite

- **WHEN** the shared contract suite runs against the memory adapter
- **THEN** every suite case passes including each typed failure code

#### Scenario: File System Access adapter passes contract suite

- **WHEN** the shared contract suite runs against the File System Access adapter
- **THEN** every suite case passes including each typed failure code

### Requirement: Worker SHA-256 hashing

The system SHALL compute SHA-256 content hashes for asset bytes in a Web Worker. Hashing MUST NOT run as blocking work on the main thread. Digests MUST be returned as 64-character lowercase hexadecimal strings.

#### Scenario: Hash produced off main thread

- **WHEN** hashing is requested for file bytes that need a content hash
- **THEN** the digest is computed in a Web Worker and returned as a 64-character lowercase hexadecimal SHA-256 string

### Requirement: Size and mtime hash fast path

When an existing asset record already has a `contentHash` and matching `byteSize` and `mtimeMs` for the same source root and relative path, the system MUST reuse that hash and MUST NOT require a new full-file hash.

#### Scenario: Size and mtime skip full hash

- **WHEN** a scanned entry matches an asset record on source root id, relative path, byte size, and mtime, and that record already has a `contentHash`
- **THEN** the system reuses that hash without hashing the full file again

### Requirement: Lowest-priority hash scheduling

Hash jobs MUST be scheduled at the lowest priority in the shared asset worker pool so visible decode and preview jobs run first.

#### Scenario: Hash waits behind higher-priority work

- **WHEN** a visible or background decode/preview job and a hash job are queued together in the shared asset worker pool
- **THEN** the higher-priority job starts first and the hash job waits

### Requirement: Background metadata extraction

The system SHALL extract asset metadata fields defined by book-core (`widthPx`, `heightPx`, `orientation`, `capturedAt`, `colorSpace`, `iccProfileName`, `mime`, and optional `meta`) from file bytes using `exifr` inside the shared asset worker pool. Metadata extraction jobs MUST run at background priority (above hash). The extractor MUST include `meta.gps` only when the caller passes an explicit GPS opt-in flag (default off) and EXIF provides finite coordinates. Missing EXIF fields MUST be omitted rather than invented.

#### Scenario: Metadata job fills schema fields off the main thread

- **WHEN** metadata extraction is requested for image bytes that contain EXIF capture time, orientation, and color-space information
- **THEN** the job runs in the shared asset worker pool at background priority and returns those fields in book-core asset-record shape without blocking the main thread on `exifr` parse

#### Scenario: GPS included only when caller opts in

- **WHEN** image bytes include finite GPS latitude and longitude in EXIF and the caller passes GPS opt-in
- **THEN** the extracted metadata includes `meta.gps` with those coordinates

#### Scenario: GPS omitted without opt-in

- **WHEN** image bytes include finite GPS latitude and longitude in EXIF and the caller does not pass GPS opt-in
- **THEN** the extracted metadata omits `meta.gps`

#### Scenario: Absent EXIF fields stay absent

- **WHEN** image bytes lack a given optional metadata field
- **THEN** the extraction result omits that field rather than inventing a placeholder

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

### Requirement: Pure match and relink

The system SHALL expose a pure function that, given book asset records and a list of scanned domain entries (with optional content hashes), returns a match mapping from asset id to scanned entry (or unmatched) and a per-asset status of `ok`, `missing`, or `modified` for assets belonging to the scanned source root. Matching MUST prefer equal `contentHash` when both sides have one. When hashes are absent, matching MAY use source root id, relative path, byte size, and mtime as a secondary key. Status MUST be `ok` when the asset's file is present at the same root and relative path with matching size and mtime, or when content hashes match; `missing` when no scanned entry accounts for the asset; `modified` when the same root and relative path exist but size/mtime differ and either both content hashes are present and differ or at least one side lacks a content hash. The function MUST NOT perform I/O or touch platform handles.

#### Scenario: Hash match wins

- **WHEN** a scanned entry and an asset record share the same content hash
- **THEN** the match result pairs that asset id to that entry even if the relative path differs and the asset status is `ok`

#### Scenario: Path metadata fallback

- **WHEN** neither side has a usable content hash but source root id, relative path, byte size, and mtime all match
- **THEN** the match result pairs that asset id to that scanned entry and the asset status is `ok`

#### Scenario: Modified when path matches but size mtime and hash differ

- **WHEN** a scanned entry shares source root id and relative path with an asset record but byte size and mtime differ and both sides have content hashes that differ
- **THEN** the match result reports that asset's status as `modified`

#### Scenario: Modified when path matches size mtime differ without both hashes

- **WHEN** a scanned entry shares source root id and relative path with an asset record, byte size and mtime differ, and at least one side lacks a content hash
- **THEN** the match result reports that asset's status as `modified`

#### Scenario: Missing when no entry accounts for the asset

- **WHEN** no scanned entry matches an asset record by content hash or by source root id, relative path, byte size, and mtime
- **THEN** the match result reports that asset's status as `missing`

#### Scenario: No I/O in matcher

- **WHEN** the match function runs
- **THEN** it returns only derived match data and does not read files or use filesystem handles

### Requirement: Assets module boundary

Asset-source code SHALL live under `src/assets` and MUST NOT import React or DOM UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/assets`. The session `File` retain map under `src/photo` remains a separate concern and MUST NOT be the domain asset-source API.

#### Scenario: Core stays independent of assets

- **WHEN** dependency rules are evaluated
- **THEN** no `src/core` module depends on `src/assets`

### Requirement: Visibility must not abort off-screen import jobs

Filmstrip or viewport visibility MAY raise decode priority for on-screen assets. Visibility changes MUST NOT abort in-flight import or decode jobs for off-screen assets; aborted work that never retries leaves permanent gray placeholders.

#### Scenario: Scrolling away does not cancel an in-flight import decode

- **WHEN** an import decode job is running for an asset that scrolls out of the filmstrip viewport
- **THEN** that job is not aborted solely due to leaving the viewport

### Requirement: Batched folder import without main-thread full walk

First photo-folder import MUST NOT collect or hash the entire directory tree in one synchronous main-thread pass. After the directory handle is obtained, the system SHALL discover entries via worker `scanRoot` (or equivalent off-main-thread walk) and process files in bounded batches with yields so the UI can paint incremental progress. Resolving `File` / hashing / decode for an entry MAY happen per batch; the picker path MUST NOT await a complete in-memory `File[]` for the whole tree before starting progressive import.

#### Scenario: Large folder import stays interruptible

- **WHEN** the user picks a photo folder containing thousands of image files
- **THEN** import progress updates incrementally and the main thread is not blocked by a single full-tree collect or hash before the first progress paint

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL verify / re-hash used-in-book files before remaining folder entries. Priority order MUST be: (1) placed assets on the open book’s visible spread, (2) other assets of the open book for that `sourceRootId`, (3) asset refs from other library books matching the same `sourceRootId` and `relativePath`. After known gallery tiles are restored, scanned folder entries whose `relativePath` is not yet in the open book’s gallery MUST continue importing in background batches (yielded, cancellable). Remaining already-imported unused files MAY still be hashed lazily. Size/mtime hash fast path remains in force for unchanged entries.

#### Scenario: Used-in-book files finish before lazy remainder

- **WHEN** a restored root has both placed open-book assets and many unused files
- **THEN** verify/re-hash of the prioritized used-in-book set completes before idle processing of the unused remainder begins

#### Scenario: Visible spread is highest priority

- **WHEN** the open book has placed assets on the visible spread and other placed assets on non-visible spreads
- **THEN** visible-spread placed assets are verified before other open-book assets for that root

#### Scenario: Lazy remainder is cancellable

- **WHEN** idle re-scan of unused files is running and the user changes folder or tears down the session
- **THEN** pending lazy work is cancelled and MUST NOT continue hashing after cancel

#### Scenario: Mid-import reload continues missing gallery entries

- **WHEN** a book was partially imported, persisted with some gallery ids, and reloads with a granted photo root whose scan lists additional image paths not in the gallery
- **THEN** saved gallery tiles (especially book-used) are visible immediately and the missing scanned paths continue importing in the background
