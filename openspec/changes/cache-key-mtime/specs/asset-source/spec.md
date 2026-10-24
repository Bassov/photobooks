## ADDED Requirements

### Requirement: Derived cache keys do not use content hashing

Import, reload, and rescan paths that already know path/size/mtime MUST obtain DerivedCache keys from that identity (or a stable digest of it) and MUST NOT read whole file bodies solely to compute `contentHash` for caching. Body reads for decode/encode remain allowed on their own paths.

#### Scenario: Reload hydrate without hashContent

- **WHEN** a saved book with complete identity is restored and DerivedCache holds thumb/tier presets for those identity digests
- **THEN** filmstrip thumbs and frame previews hydrate without calling `hashContent` and without reading original file bodies for the cache lookup

## MODIFIED Requirements

### Requirement: Match assets by path metadata

The system SHALL expose a pure function that, given book asset records and a list of scanned domain entries, returns a match mapping from asset id to scanned entry (or unmatched) and a per-asset status of `ok`, `missing`, or `modified`. Matching and change detection MUST use only `relativePath`, `byteSize`, and `mtimeMs` (source root id MAY differ on relink). The function MUST NOT prefer or require `contentHash` for identity or status. Status MUST be `ok` when a scanned entry shares relative path with matching size and mtime; `missing` when no scanned entry accounts for the asset by path; `modified` when the same relative path exists but size or mtime differ. The function MUST NOT perform I/O or touch platform handles.
