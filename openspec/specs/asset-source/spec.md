# asset-source Specification

## Purpose

Defines the domain contract for reading photo-folder originals, scanning source roots, optional off-hot-path content hashes, and purely matching scanned files to book asset records by path/size/mtime for open/save and relink flows.

## Requirements

### Requirement: Domain asset source API

The system SHALL expose a domain asset-source API that registers read-only source roots, lists scanned file entries for a root, resolves a live `File` for session retain without reading the file body, and resolves an entry for hashing or identity updates using domain types only. The API MUST NOT accept or return filesystem handles. Relative paths MAY appear as domain strings that match asset-record `relativePath` values.

#### Scenario: Scan returns domain entries

- **WHEN** a source root is registered and scanned
- **THEN** the result lists entries with relative path, byte size, and mtime as domain fields without exposing a directory handle

#### Scenario: Handles stay off the domain API

- **WHEN** a caller uses only the domain asset-source API
- **THEN** no method parameter or return value is a File System Access directory or file handle

#### Scenario: Resolve File without body read

- **WHEN** a caller needs a session `File` for an entry whose path is known
- **THEN** `resolveFile` returns that `File` without requiring the caller to read `arrayBuffer` / full body bytes

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

Filmstrip or viewport visibility MUST place on-screen and book-used assets on the **now** decode lane and MAY enqueue other gallery assets on the **background** lane only during idle time. When an asset leaves the now set (and is not book-used), the system MUST drop that asset's queued thumb/working decode jobs and abort its in-flight working-preview (1280) job. An in-flight thumb320 job MUST run to completion and its result MUST be published and stored. The system MUST re-enqueue at now when the asset re-enters without a hot thumb. Per-asset abort MUST NOT cancel the gallery import batch or list-first placeholder progress; aborted work that never retries MUST NOT leave permanent gray placeholders.

#### Scenario: Scrolling away drops queued decode

- **WHEN** a thumb decode job is queued for an asset that leaves the filmstrip/spread now set and is not book-used
- **THEN** that job is aborted solely due to leaving the now set

#### Scenario: Scrolling away keeps an in-flight thumb

- **WHEN** a thumb320 decode is already running for an asset that leaves the now set
- **THEN** the decode finishes and the import publishes and stores its thumb

#### Scenario: Re-entry retries decode

- **WHEN** a cancelled asset re-enters the now set without a hot thumb
- **THEN** decode is queued again on the now lane

#### Scenario: Import batch continues after per-asset abort

- **WHEN** off-now thumb jobs are aborted during an import
- **THEN** list-first gallery placeholders and the import batch continue for remaining files

### Requirement: Batched folder import without main-thread full walk

First photo-folder import MUST NOT collect or hash the entire directory tree on the main thread. After the directory handle is obtained, the system SHALL discover entries via worker `scanRoot` (or equivalent off-main-thread walk), enqueue gallery placeholders before body reads, then resolve `File` / decode for prioritized entries in bounded batches with yields. The picker MUST NOT await a complete in-memory `File[]` for the whole tree before list-first UI. Content-hash MUST NOT run on this import hot path.

#### Scenario: Large folder import stays interruptible

- **WHEN** the user picks a photo folder containing thousands of image files
- **THEN** gallery placeholders appear from the cheap scan before body reads finish and the main thread is not blocked by a single full-tree collect or hash before the first progress paint

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL hydrate the gallery from the persisted folder manifest when present (path, size, mtime, and dims/orientation when known) so slots and identity-keyed DerivedCache thumbs can render before the walk finishes. It SHALL then always run a cheap full worker `scanRoot` (path/size/mtime only; no body reads). It MUST compare that list to the manifest and book assets for new/changed files and MUST NOT skip the walk based solely on entry count, max-mtime, or manifest presence. After list-first gallery enqueue from the walk, the system MUST finish flushing pending gallery ids into `book.gallery` before building the priority verify plan, so unchanged newly listed paths are not misclassified into the lazy import remainder. Priority verify MUST reattach session `File`s via `resolveFile` / `getFile` and MUST NOT call `readForHash` or full-file `arrayBuffer` / `new File([buffer])` when scanned size+mtime match the asset record; verify MUST run with bounded concurrency in the same order as the import body-read cap (8–16), with coalesced progress updates. After the walk, thumb320 / preview MUST prefer the **now** set (visible spread ∪ book-used ∪ mounted filmstrip); remaining entries stay placeholders until needed. Content-hash MUST NOT run on this rescan hot path.

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

#### Scenario: Unchanged size+mtime skips body read on priority verify

- **WHEN** priority verify runs for a gallery asset whose scanned size and mtime match the asset record
- **THEN** the session retains a `File` from `resolveFile` / `getFile` and does not read the full file body via `readForHash` or `arrayBuffer`

#### Scenario: Gallery list flush precedes priority plan

- **WHEN** the cheap walk enqueues new list-first gallery placeholders that are still pending flush
- **THEN** those paths are included in the priority plan after flush and are not sent through lazy folder import solely because the gallery snapshot lagged

#### Scenario: Mid-import reload continues missing gallery entries

- **WHEN** a book was partially imported, persisted with some gallery ids, and reloads with a granted photo root whose scan lists additional image paths not in the gallery
- **THEN** saved gallery tiles (especially book-used) are visible immediately and the missing scanned paths are list-enqueued, flushed into the gallery, and priority-verified (session `File` retained) so they are not left solely for a misclassified lazy import pass

### Requirement: JPEG head pass for dims and EXIF thumb

After list-first gallery enqueue for JPEG sources, the system SHALL read a bounded file head (≤64 KiB) with capped parallelism (same order as import body-read cap, with yields) to (1) publish an IFD1 embedded thumbnail as a temporary filmstrip thumb until thumb320 replaces it, and (2) obtain width/height/orientation from JPEG SOF/EXIF for session aspect and the folder manifest. Absent/corrupt thumbs MUST leave the placeholder. The head pass MUST NOT require a full-file decode; assets with real dims or hot thumb320 MAY skip it. Full-body decode for off-now JPEG MUST wait until visible ∪ book-used (same lazy policy as HEIC).

#### Scenario: Embedded EXIF thumb or grey placeholder before thumb320

- **WHEN** a first-import JPEG has (or lacks) a usable IFD1 thumbnail and thumb320 is not ready
- **THEN** the filmstrip shows that embedded thumb or the ordinary placeholder until thumb320 publishes

#### Scenario: Head dims and off-now lazy decode

- **WHEN** a JPEG head yields SOF/EXIF dims, or a gallery JPEG stays outside visible ∪ book-used
- **THEN** aspect/manifest update without createImageBitmap, and full decode waits until the asset enters that set

### Requirement: Persisted folder manifest for matching and hydrate

The system SHALL persist a per-`sourceRootId` folder manifest in IndexedDB after cheap walks / JPEG head dims / decode dims. Entries MUST store relative path, size, mtime (MAY store width/height/orientation). The manifest MUST hydrate gallery list/aspects before the next walk completes and match new/changed/removed against the latest scan, MUST NOT skip the walk, stores metadata only, batches writes with yields, and ignores corrupt/version-mismatched data (rebuild on next scan).

#### Scenario: Manifest walk update, no skip, corrupt/head dims

- **WHEN** a cheap `scanRoot` completes, or a prior manifest exists, or bytes are corrupt/unsupported / head pass yields dims
- **THEN** the manifest updates (preserving dims when size+mtime unchanged), the next visit still walks, corrupt data is ignored without crash, and head dims land without waiting for thumb320

### Requirement: Import decode reuses one body read for library seed

When a full original body is read for import decode/encode, the system MUST reuse those bytes for library `seedAndHashEntry` (no second full-file `arrayBuffer` on the happy path). The seed applies to memory-backed roots only (a registered memory source, or none yet): the decode worker returns the body (transferred, not cloned) only for those. FSA-backed roots skip the seed and the body copy; files re-resolve from the folder handle and only identity-keyed DerivedCache puts run. Deferred lazy assets MAY skip body read until decode runs.

#### Scenario: Seed uses preloaded bytes

- **WHEN** import decode already has the file body for an asset whose root is memory-backed
- **THEN** seed uses those bytes without a second full-file body read

#### Scenario: FSA root skips the seed

- **WHEN** an asset whose root has a registered FSA source finishes import decode
- **THEN** the worker result carries no source body and no memory seed runs
