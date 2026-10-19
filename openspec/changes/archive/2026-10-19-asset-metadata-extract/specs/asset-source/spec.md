## ADDED Requirements

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

`AssetSource.scanRoot` SHALL walk the registered source root's folder tree inside a Web Worker. The walk MUST NOT run as blocking work on the main thread. Domain `scanRoot` results MUST remain typed domain entries without exposing filesystem handles on the domain API.

#### Scenario: Scan walk runs in a worker

- **WHEN** a caller invokes `scanRoot` on a registered root with readable entries
- **THEN** the directory walk executes in a Web Worker and the caller receives domain `ScannedEntry` values (relative path, byte size, mtime)

#### Scenario: Scan failure stays typed

- **WHEN** the worker cannot complete the walk because permission is required or the root is unreadable
- **THEN** `scanRoot` fails with the corresponding typed code (`permission-required` or `corrupted` / `not-found`) and MUST NOT silently fall back to a main-thread walk

## MODIFIED Requirements

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
