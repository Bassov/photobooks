## MODIFIED Requirements

### Requirement: Preview bytes use derived cache when identity is complete

When an asset has complete durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`), the system SHALL persist generated working-preview bytes in the derived cache under the identity digest and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When identity is incomplete, preview caching MUST remain memory-only (hot object-URL LRU) without writing fabricated keys. Whole-file `contentHash` MUST NOT be required for put or hydrate. Thumb320 prioritization (visible ∪ book-used first) is unchanged.

#### Scenario: Identity-complete asset hydrates working preview from derived cache

- **WHEN** the hot working-preview URL is missing, the asset has a complete identity, and the derived cache already holds the working-preview preset for that identity digest
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Identity-complete asset stores working preview after encode

- **WHEN** the working preview is encoded for an asset that has a complete identity
- **THEN** those preview bytes are put into the derived cache under the identity digest and the working-preview preset id

#### Scenario: Incomplete identity skips derived cache

- **WHEN** the working preview or thumb320 is encoded for an asset without complete identity
- **THEN** the system does not put a derived-cache entry under a fabricated key
