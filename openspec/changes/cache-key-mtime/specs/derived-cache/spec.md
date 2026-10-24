## ADDED Requirements

### Requirement: Derived cache key is identity digest

`assetHash` MUST be a 64-character lowercase hexadecimal digest of durable asset identity (`sourceRootId` + `relativePath` + `byteSize` + `mtimeMs`), not a hash of file bytes. `presetId` MUST remain a non-empty domain string identifying the derivative kind and size. When size or mtime changes, the identity digest MUST change so prior entries miss and previews regenerate; stale OPFS rows MAY remain until normal eviction.

#### Scenario: Valid identity key accepted

- **WHEN** an entry is put with a 64-char lowercase hex identity digest and a non-empty `presetId`
- **THEN** a subsequent get with the same key succeeds

#### Scenario: Metadata change misses old key

- **WHEN** `byteSize` or `mtimeMs` for the same path/root differs from the key used to put
- **THEN** get with the new identity digest misses (`not-found`) and does not return the prior bytes

### Requirement: Encode-after-identity thumb puts are awaited

When the editor publishes a thumb URL and then puts encoded bytes into DerivedCache keyed by the identity digest, that put MUST be registered with the pending-put tracker (`trackHashJob` / `awaitPendingHashes`) so Save cannot finish before the OPFS write settles. Import, reload, and rescan MUST NOT run whole-file `hashContent` to obtain a DerivedCache key.

#### Scenario: Save waits for identity-keyed put

- **WHEN** a thumb is published and a DerivedCache put is started for that asset’s identity digest
- **THEN** `awaitPendingHashes` does not resolve until that put settles

#### Scenario: No content-hash for cache keys

- **WHEN** import, reload, or prioritized rescan runs for assets with complete path/size/mtime identity
- **THEN** DerivedCache put/get uses the identity digest and does not require `hashContent` of file bodies

## REMOVED Requirements

### Requirement: Derived cache key shape

### Requirement: Encode-after-hash thumb puts are awaited
