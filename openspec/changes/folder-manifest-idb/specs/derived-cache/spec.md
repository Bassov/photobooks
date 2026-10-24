## MODIFIED Requirements

### Requirement: Derived cache keys do not use content hashing

Import, reload, and rescan paths that already know path/size/mtime MUST obtain DerivedCache keys from that identity (or a stable digest of it) and MUST NOT read whole file bodies solely to compute `contentHash` for caching. Body reads for decode/encode remain allowed on their own paths. On reload, identity fields from the folder manifest (when present) MUST be sufficient to look up existing thumb/tier entries before the folder walk completes.

#### Scenario: Reload hydrate without hashContent

- **WHEN** a saved book with complete identity is restored and DerivedCache holds thumb/tier presets for those identity digests
- **THEN** filmstrip thumbs and frame previews hydrate without calling `hashContent` and without reading original file bodies for the cache lookup

#### Scenario: Manifest identity hydrates before scan

- **WHEN** a restored root’s folder manifest supplies path/size/mtime for an asset and DerivedCache holds the thumb preset for that identity digest
- **THEN** the filmstrip MAY show the cached thumb before `scanRoot` resolves
