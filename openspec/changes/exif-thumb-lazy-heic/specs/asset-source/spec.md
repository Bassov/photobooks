## ADDED Requirements

### Requirement: JPEG head pass for dims and EXIF thumb

After list-first gallery enqueue for JPEG sources, the system SHALL read a bounded file head (at most 64 KiB) with capped parallelism (same order as import body-read cap, with yields) to (1) extract an IFD1 embedded JPEG thumbnail when present and publish it as a temporary filmstrip thumb until thumb320 replaces it, and (2) obtain width/height/orientation from JPEG SOF and EXIF via existing head parsers, apply them to session aspect, and persist them into the folder manifest. Absent or corrupt embedded thumbs MUST leave the current placeholder and MUST NOT crash. The head pass MUST NOT require a full-file decode or whole-file body read. Assets that already have real dimensions or a hot DerivedCache/thumb320 MAY skip redundant head work.

#### Scenario: Embedded EXIF thumb paints before thumb320

- **WHEN** a JPEG with an IFD1 embedded thumbnail is imported and thumb320 is not ready
- **THEN** the filmstrip may show that embedded thumbnail as a temporary tile image until the 320-tier preview replaces it

#### Scenario: Missing or corrupt EXIF thumb stays grey

- **WHEN** a JPEG has no IFD1 thumbnail or the embedded bytes are corrupt
- **THEN** the tile keeps the ordinary placeholder and import continues without throwing

#### Scenario: Header dims update aspect and manifest

- **WHEN** a JPEG head yields SOF/EXIF width, height, and orientation before full decode
- **THEN** session aspect uses those values and the folder manifest entry stores them for later hydrate

## MODIFIED Requirements

### Requirement: Persisted folder manifest for matching and hydrate

The system SHALL persist a per-`sourceRootId` folder manifest in IndexedDB after cheap walks, after the JPEG head pass supplies dimensions, and when decode supplies dimensions. Each entry MUST store relative path, byte size, and mtime, and MAY store width, height, and orientation once known. The manifest MUST be used to (1) hydrate the gallery list and aspects before the next visit’s walk completes and (2) match/detect new/changed/removed entries against the latest scan. The manifest MUST NOT substitute for the walk: every visit still performs the cheap full scan. The manifest stores metadata only (no file bodies, no content hash, no embedded thumbs). Writes MUST be batched with yields so large folders do not create main-thread long tasks. Corrupt or version-mismatched stored data MUST be ignored and rebuilt from the next scan without crashing.

#### Scenario: Manifest updates after a cheap walk

- **WHEN** a cheap full `scanRoot` completes for a registered root
- **THEN** the persisted folder manifest for that `sourceRootId` is updated to the scanned path/size/mtime set, preserving prior width/height/orientation when size and mtime are unchanged and clearing them when size or mtime change

#### Scenario: Manifest alone does not skip the walk

- **WHEN** a persisted folder manifest already exists for the root
- **THEN** the next visit still runs the cheap full walk before using the manifest for matching

#### Scenario: Corrupt or version-mismatched manifest is ignored

- **WHEN** stored manifest bytes are corrupt or the schema version is unsupported
- **THEN** the reader treats the manifest as missing, the UI does not crash, and the next successful scan rebuilds it

#### Scenario: Head-pass dims land in the manifest

- **WHEN** the JPEG head pass obtains width/height/orientation for an identity-complete asset
- **THEN** those dimensions are written into the folder manifest without waiting for thumb320 decode
