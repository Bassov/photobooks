# Spec Delta

## ADDED Requirements

### Requirement: Tier bytes use derived cache when hashed

When an asset has a known `contentHash`, the system SHALL persist generated zoom-tier preview bytes in the derived cache under that hash and a tier preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding a new tier from the session file. When `contentHash` is absent, tier caching MUST remain memory-only (hot object-URL LRU) without writing fake hash keys.

#### Scenario: Hashed asset hydrates tier from derived cache

- **WHEN** a covering tier’s hot object URL is missing, the asset has a `contentHash`, and the derived cache already holds that tier preset
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Hashed asset stores tier after encode

- **WHEN** a covering tier is encoded for an asset that has a `contentHash`
- **THEN** those preview bytes are put into the derived cache under that hash and the tier’s preset id

#### Scenario: Unhashed asset skips derived cache

- **WHEN** a covering tier is encoded for an asset without a `contentHash`
- **THEN** the system does not put a derived-cache entry under a fabricated hash
