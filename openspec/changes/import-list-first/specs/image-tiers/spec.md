## MODIFIED Requirements

### Requirement: Preview bytes use derived cache when hashed

When an asset has a known `contentHash` (produced off the import/rescan hot path), the system SHALL persist generated working-preview bytes in the derived cache under that hash and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When `contentHash` is absent — the default after list-first import/rescan — preview caching MUST remain memory-only (hot object-URL LRU) without writing fake hash keys. Thumb320 generation for filmstrip MUST prioritize visible and book-used assets; remaining gallery entries MAY stay without a 320 preview until needed.

#### Scenario: Hashed asset hydrates working preview from derived cache

- **WHEN** the hot working-preview URL is missing, the asset has a `contentHash`, and the derived cache already holds the working-preview preset
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Hashed asset stores working preview after encode

- **WHEN** the working preview is encoded for an asset that has a `contentHash`
- **THEN** those preview bytes are put into the derived cache under that hash and the working-preview preset id

#### Scenario: Unhashed asset skips derived cache

- **WHEN** the working preview or thumb320 is encoded for an asset without a `contentHash`
- **THEN** the system does not put a derived-cache entry under a fabricated hash

#### Scenario: Idle gallery entries defer thumb320

- **WHEN** many gallery assets are placeholders and only a subset are visible or book-used
- **THEN** thumb320 encode runs for the visible/book-used subset first and idle entries may remain without a 320 preview
