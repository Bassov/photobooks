## MODIFIED Requirements

### Requirement: Worker SHA-256 hashing

The system MAY compute SHA-256 content hashes for asset bytes in a Web Worker when explicitly requested off the import/rescan/match hot path. Hashing MUST NOT run as blocking work on the main thread. Digests MUST be returned as 64-character lowercase hexadecimal strings. Import, reload rescan, list matching, and change detection MUST NOT require or await content hashes.

#### Scenario: Hash produced off main thread when requested

- **WHEN** hashing is explicitly requested for file bytes off the import/rescan hot path
- **THEN** the digest is computed in a Web Worker and returned as a 64-character lowercase hexadecimal SHA-256 string

#### Scenario: Hot path does not await content hash

- **WHEN** the editor imports or rescans a photo folder for gallery list and identity
- **THEN** placeholders, match/reuse, and thumb320 priority work proceed without computing or awaiting content hashes

### Requirement: Pure match and relink

The system SHALL expose a pure function that, given book asset records and a list of scanned domain entries, returns a match mapping from asset id to scanned entry (or unmatched) and a per-asset status of `ok`, `missing`, or `modified` for assets belonging to the scanned source root. Matching and change detection MUST use only `sourceRootId`, `relativePath`, `byteSize`, and `mtimeMs`. The function MUST NOT prefer or require `contentHash` for identity or status. Status MUST be `ok` when the asset's file is present at the same root and relative path with matching size and mtime; `missing` when no scanned entry accounts for the asset; `modified` when the same root and relative path exist but size or mtime differ. The function MUST NOT perform I/O or touch platform handles.

#### Scenario: Path metadata match is ok

- **WHEN** a scanned entry and an asset record share source root id, relative path, byte size, and mtime
- **THEN** the match result pairs that asset id to that scanned entry and the asset status is `ok`

#### Scenario: Modified when path matches but size or mtime differ

- **WHEN** a scanned entry shares source root id and relative path with an asset record but byte size or mtime differ
- **THEN** the match result reports that asset's status as `modified`

#### Scenario: Missing when no entry accounts for the asset

- **WHEN** no scanned entry matches an asset record by source root id, relative path, byte size, and mtime
- **THEN** the match result reports that asset's status as `missing`

#### Scenario: Content hash is ignored for matching

- **WHEN** a scanned entry and an asset record share a content hash but differ in relative path, size, or mtime
- **THEN** the match result does not treat that hash equality as identity and MUST NOT mark the asset `ok` solely because hashes match

#### Scenario: No I/O in matcher

- **WHEN** the match function runs
- **THEN** it returns only derived match data and does not read files or use filesystem handles

### Requirement: Batched folder import without main-thread full walk

First photo-folder import MUST NOT collect or hash the entire directory tree in one synchronous main-thread pass. After the directory handle is obtained, the system SHALL discover entries via worker `scanRoot` (or equivalent off-main-thread walk), enqueue gallery placeholders from that entry list before body reads, then resolve `File` / decode for prioritized entries in bounded batches with yields. The picker path MUST NOT await a complete in-memory `File[]` for the whole tree before starting list-first UI. Content-hash computation MUST NOT run on this import hot path.

#### Scenario: Large folder import stays interruptible

- **WHEN** the user picks a photo folder containing thousands of image files
- **THEN** gallery placeholders appear from the cheap scan before body reads finish and the main thread is not blocked by a single full-tree collect or hash before the first progress paint

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL always run a cheap full worker `scanRoot` (relative path, byte size, mtime only; no body reads during the walk). It MUST compare that full entry list to the persisted entry index and book assets to detect new and metadata-changed files. It MUST NOT skip the walk based solely on entry count or max-mtime. After the walk, gallery list-first UI MUST show immediately; thumb320 / preview work MUST prioritize (1) placed assets on the open book’s visible spread, (2) other open-book assets for that `sourceRootId`, (3) mounted filmstrip tiles; remaining entries stay placeholders until needed. Content-hash MUST NOT run on this rescan hot path.

#### Scenario: Every visit walks the full tree cheaply

- **WHEN** a granted photo root is restored or rescanned
- **THEN** worker `scanRoot` walks the full folder tree for name/size/mtime and does not skip the walk because a stored count or max-mtime matches

#### Scenario: New and changed entries are detected vs the index

- **WHEN** the cheap walk finds a new relative path or a path whose size/mtime differs from the persisted entry index
- **THEN** that entry is treated as new or changed for gallery/identity updates

#### Scenario: Visible and book-used previews before idle remainder

- **WHEN** a restored root has both placed open-book assets and many unused files
- **THEN** thumb320 / preview for visible-spread and other book-used assets is queued before idle decode of unused placeholders

#### Scenario: Mid-import reload continues missing gallery entries

- **WHEN** a book was partially imported, persisted with some gallery ids, and reloads with a granted photo root whose scan lists additional image paths not in the gallery
- **THEN** saved gallery tiles (especially book-used) are visible immediately and the missing scanned paths continue importing in the background

## ADDED Requirements

### Requirement: Persisted entry index for matching

The system SHALL persist a per-`sourceRootId` entry index of relative path → byte size and mtime after each cheap full walk. The index MUST be used to match and detect new/changed entries against the latest scan. The index MUST NOT substitute for the walk: every visit still performs the cheap full scan. The index stores metadata only (no file bodies).

#### Scenario: Index updates after a cheap walk

- **WHEN** a cheap full `scanRoot` completes for a registered root
- **THEN** the persisted entry index for that `sourceRootId` is updated to the scanned path/size/mtime set

#### Scenario: Index alone does not skip the walk

- **WHEN** a persisted entry index already exists for the root
- **THEN** the next visit still runs the cheap full walk before using the index for matching

## REMOVED Requirements

### Requirement: Size and mtime hash fast path

### Requirement: Lowest-priority hash scheduling
