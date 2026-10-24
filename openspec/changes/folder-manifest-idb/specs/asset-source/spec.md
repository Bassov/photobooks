## MODIFIED Requirements

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
