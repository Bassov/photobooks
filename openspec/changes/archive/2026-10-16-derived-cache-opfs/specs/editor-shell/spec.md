# Spec Delta

## ADDED Requirements

### Requirement: Thumbnail bytes use derived cache when hashed

When an asset has a known `contentHash`, the system SHALL persist filmstrip thumbnail preview bytes in the derived cache under that hash and a thumbnail preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before requesting a new thumbnail encode.

#### Scenario: Hashed asset hydrates thumbnail from derived cache

- **WHEN** a filmstrip thumbnail’s hot object URL is missing, the asset has a `contentHash`, and the derived cache already holds the thumbnail preset
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Hashed asset stores thumbnail after encode

- **WHEN** a thumbnail preview is produced for an asset that has a `contentHash`
- **THEN** those preview bytes are put into the derived cache under that hash and the thumbnail preset id

### Requirement: Unhashed thumbnails stay memory-only

When `contentHash` is absent, thumbnail caching MUST remain memory-only without writing fake hash keys. Filmstrip layout, virtualization, and accessible naming MUST remain unchanged.

#### Scenario: Unhashed asset skips derived cache for thumbnails

- **WHEN** a thumbnail preview is produced for an asset without a `contentHash`
- **THEN** the system does not put a derived-cache entry under a fabricated hash
