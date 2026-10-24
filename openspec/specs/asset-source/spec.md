# asset-source Specification

## Purpose

Defines the domain contract for reading photo-folder originals, scanning source roots, optional off-hot-path content hashes, and purely matching scanned files to book asset records by path/size/mtime for open/save and relink flows.

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

The system MAY compute SHA-256 content hashes for asset bytes in a Web Worker when explicitly requested off the import/rescan/match hot path. Hashing MUST NOT run as blocking work on the main thread. Digests MUST be returned as 64-character lowercase hexadecimal strings. Import, reload rescan, list matching, and change detection MUST NOT require or await content hashes.

#### Scenario: Hash produced off main thread when requested

- **WHEN** hashing is explicitly requested for file bytes off the import/rescan hot path
- **THEN** the digest is computed in a Web Worker and returned as a 64-character lowercase hexadecimal SHA-256 string

#### Scenario: Hot path does not await content hash

- **WHEN** the editor imports or rescans a photo folder for gallery list and identity
- **THEN** placeholders, match/reuse, and thumb320 priority work proceed without computing or awaiting content hashes

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

The system SHALL expose a pure function that, given book asset records and a list of scanned domain entries, returns a match mapping from asset id to scanned entry (or unmatched) and a per-asset status of `ok`, `missing`, or `modified`. Matching and change detection MUST use only `relativePath`, `byteSize`, and `mtimeMs` (source root id MAY differ on relink). The function MUST NOT prefer or require `contentHash` for identity or status. Status MUST be `ok` when a scanned entry shares relative path with matching size and mtime; `missing` when no scanned entry accounts for the asset by path; `modified` when the same relative path exists but size or mtime differ. The function MUST NOT perform I/O or touch platform handles.

#### Scenario: Path metadata match is ok

- **WHEN** a scanned entry and an asset record share relative path, byte size, and mtime
- **THEN** the match result pairs that asset id to that scanned entry and the asset status is `ok`

#### Scenario: Relink matches across a new source root id

- **WHEN** a scanned entry matches an asset on relative path, size, and mtime but the asset's `sourceRootId` differs from the scan's root id
- **THEN** the match result still pairs that asset and reports status `ok`

#### Scenario: Modified when path matches but size or mtime differ

- **WHEN** a scanned entry shares relative path with an asset record but byte size or mtime differ
- **THEN** the match result reports that asset's status as `modified`

#### Scenario: Missing when no entry accounts for the asset

- **WHEN** no scanned entry matches an asset record by relative path, byte size, and mtime
- **THEN** the match result reports that asset's status as `missing`

#### Scenario: Content hash is ignored for matching

- **WHEN** a scanned entry and an asset record share a content hash but differ in relative path, size, or mtime
- **THEN** the match result does not treat that hash equality as identity and MUST NOT mark the asset `ok` solely because hashes match

#### Scenario: No I/O in matcher

- **WHEN** the match function runs
- **THEN** it returns only derived match data and does not read files or use filesystem handles

### Requirement: Derived cache keys do not use content hashing

Import, reload, and rescan paths that already know path/size/mtime MUST obtain DerivedCache keys from that identity (or a stable digest of it) and MUST NOT read whole file bodies solely to compute `contentHash` for caching. Body reads for decode/encode remain allowed on their own paths. On reload, identity fields from the folder manifest (when present) MUST be sufficient to look up existing thumb/tier entries before the folder walk completes.

#### Scenario: Reload hydrate without hashContent

- **WHEN** a saved book with complete identity is restored and DerivedCache holds thumb/tier presets for those identity digests
- **THEN** filmstrip thumbs and frame previews hydrate without calling `hashContent` and without reading original file bodies for the cache lookup

#### Scenario: Manifest identity hydrates before scan

- **WHEN** a restored root’s folder manifest supplies path/size/mtime for an asset and DerivedCache holds the thumb preset for that identity digest
- **THEN** the filmstrip MAY show the cached thumb before `scanRoot` resolves

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

First photo-folder import MUST NOT collect or hash the entire directory tree in one synchronous main-thread pass. After the directory handle is obtained, the system SHALL discover entries via worker `scanRoot` (or equivalent off-main-thread walk), enqueue gallery placeholders from that entry list before body reads, then resolve `File` / decode for prioritized entries in bounded batches with yields. The picker path MUST NOT await a complete in-memory `File[]` for the whole tree before starting list-first UI. Content-hash computation MUST NOT run on this import hot path.

#### Scenario: Large folder import stays interruptible

- **WHEN** the user picks a photo folder containing thousands of image files
- **THEN** gallery placeholders appear from the cheap scan before body reads finish and the main thread is not blocked by a single full-tree collect or hash before the first progress paint

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL first hydrate the gallery list from the persisted folder manifest when present (relative path, size, mtime, and width/height/orientation when known) so filmstrip slots and identity-keyed DerivedCache thumbs can render before the walk finishes. It SHALL then always run a cheap full worker `scanRoot` (relative path, byte size, mtime only; no body reads during the walk). It MUST compare that full entry list to the persisted manifest and book assets to detect new and metadata-changed files. It MUST NOT skip the walk based solely on entry count, max-mtime, or manifest presence. After the walk, thumb320 / preview work MUST prioritize (1) placed assets on the open book’s visible spread, (2) other open-book assets for that `sourceRootId`, (3) mounted filmstrip tiles; remaining entries stay placeholders until needed. Content-hash MUST NOT run on this rescan hot path.

#### Scenario: Manifest paints before the walk finishes

- **WHEN** a granted photo root is restored and a valid folder manifest exists for that `sourceRootId`
- **THEN** gallery placeholders (with aspects when dimensions are stored) appear and identity-complete thumbs MAY hydrate from DerivedCache before `scanRoot` resolves

#### Scenario: Every visit walks the full tree cheaply

- **WHEN** a granted photo root is restored or rescanned
- **THEN** worker `scanRoot` walks the full folder tree for name/size/mtime and does not skip the walk because a stored count, max-mtime, or manifest matches

#### Scenario: New and changed entries are detected vs the manifest

- **WHEN** the cheap walk finds a new relative path or a path whose size/mtime differs from the persisted folder manifest
- **THEN** that entry is treated as new or changed for gallery/identity updates

#### Scenario: Visible and book-used previews before idle remainder

- **WHEN** a restored root has both placed open-book assets and many unused files
- **THEN** thumb320 / preview for visible-spread and other book-used assets is queued before idle decode of unused placeholders

#### Scenario: Mid-import reload continues missing gallery entries

- **WHEN** a book was partially imported, persisted with some gallery ids, and reloads with a granted photo root whose scan lists additional image paths not in the gallery
- **THEN** saved gallery tiles (especially book-used) are visible immediately and the missing scanned paths continue importing in the background

### Requirement: Persisted folder manifest for matching and hydrate

The system SHALL persist a per-`sourceRootId` folder manifest in IndexedDB after cheap walks and when decode supplies dimensions. Each entry MUST store relative path, byte size, and mtime, and MAY store width, height, and orientation once known. The manifest MUST be used to (1) hydrate the gallery list and aspects before the next visit’s walk completes and (2) match/detect new/changed/removed entries against the latest scan. The manifest MUST NOT substitute for the walk: every visit still performs the cheap full scan. The manifest stores metadata only (no file bodies, no content hash). Writes MUST be batched with yields so large folders do not create main-thread long tasks. Corrupt or version-mismatched stored data MUST be ignored and rebuilt from the next scan without crashing.

#### Scenario: Manifest updates after a cheap walk

- **WHEN** a cheap full `scanRoot` completes for a registered root
- **THEN** the persisted folder manifest for that `sourceRootId` is updated to the scanned path/size/mtime set, preserving prior width/height/orientation when size and mtime are unchanged and clearing them when size or mtime change

#### Scenario: Manifest alone does not skip the walk

- **WHEN** a persisted folder manifest already exists for the root
- **THEN** the next visit still runs the cheap full walk before using the manifest for matching

#### Scenario: Corrupt or version-mismatched manifest is ignored

- **WHEN** stored manifest bytes are corrupt or the schema version is unsupported
- **THEN** the reader treats the manifest as missing, the UI does not crash, and the next successful scan rebuilds it
