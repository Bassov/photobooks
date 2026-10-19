# derived-cache Specification

## Purpose

Defines the disposable preview and derivative cache keyed by asset content hash and preset id, with memory and Origin Private File System adapters proven by a shared contract suite so zoom tiers, thumbnails, and later export can rebuild without inventing storage paths.

## Requirements

### Requirement: Domain derived cache API

The system SHALL expose a domain derived-cache API that stores and retrieves derivative entries keyed by `(assetHash, presetId)` using domain types only. Each entry MUST include image bytes and a MIME type string. The API MUST NOT accept or return filesystem paths, OPFS handles, or directory handles.

#### Scenario: Put then get returns bytes and mime

- **WHEN** a derivative entry with bytes and MIME type is put for a key and then gotten with the same key
- **THEN** the get succeeds with bytes equal to those put and the same MIME type

#### Scenario: Paths and handles stay off the domain API

- **WHEN** a caller uses only the domain derived-cache API
- **THEN** no method parameter or return value is a filesystem path, OPFS handle, or directory handle

### Requirement: Derived cache key shape

`assetHash` MUST be a 64-character lowercase hexadecimal SHA-256 digest. `presetId` MUST be a non-empty domain string identifying the derivative kind and size.

#### Scenario: Valid key accepted

- **WHEN** an entry is put with a 64-char lowercase hex `assetHash` and a non-empty `presetId`
- **THEN** a subsequent get with the same key succeeds

### Requirement: Typed derived cache results

Derived-cache operations SHALL return typed success or failure results. Getting a missing key MUST fail with a typed miss (for example `not-found`). Failure codes MUST also cover at least `corrupted` when stored data cannot be read as a valid entry (bytes plus MIME type). Callers MUST distinguish these codes without inspecting thrown platform errors.

#### Scenario: Missing key is not-found

- **WHEN** the caller gets a key that has never been put
- **THEN** the result is a typed failure with code `not-found`

#### Scenario: Corrupted entry is corrupted

- **WHEN** stored data for a key cannot be read as a valid derivative entry
- **THEN** get fails with typed code `corrupted`

### Requirement: Delete and clear

The system SHALL allow deleting a single `(assetHash, presetId)` entry and clearing the entire cache. After delete, a get for that key MUST miss. After clear, every previously put key MUST miss.

#### Scenario: Delete removes one key

- **WHEN** an entry is deleted and then gotten
- **THEN** get fails with `not-found`

#### Scenario: Clear removes all keys

- **WHEN** the cache is cleared after several puts
- **THEN** get for each of those keys fails with `not-found`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory derived-cache adapter and an Origin Private File System (OPFS) adapter. Both MUST pass one shared contract-test suite that exercises put/get, miss, delete, clear, persistence across a new adapter instance on the same root (OPFS), and every named failure code. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes contract suite

- **WHEN** the shared contract suite runs against the memory adapter
- **THEN** every suite case passes including each typed failure code

#### Scenario: OPFS adapter passes contract suite

- **WHEN** the shared contract suite runs against the OPFS adapter
- **THEN** every suite case passes including each typed failure code

#### Scenario: OPFS survives a new adapter instance

- **WHEN** an entry is put through an OPFS adapter and a new adapter instance is created on the same OPFS root
- **THEN** get for that key returns the same bytes and MIME type

### Requirement: Assets module boundary

Derived-cache code SHALL live under `src/assets` and MUST NOT import React or App UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/assets`.

#### Scenario: Core stays independent of assets

- **WHEN** dependency cruiser runs
- **THEN** no `src/core` module depends on `src/assets`

### Requirement: Encode-after-hash thumb puts are awaited

When the editor publishes a thumb URL and then puts encoded bytes into DerivedCache keyed by `contentHash` (encode-after-hash), that put MUST be registered with the pending-hash tracker (`trackHashJob` / `awaitPendingHashes`) so Save cannot finish before the OPFS write settles.

#### Scenario: Save waits for encode-after-hash put

- **WHEN** a thumb is published and a DerivedCache put is started for that asset’s `contentHash`
- **THEN** `awaitPendingHashes` does not resolve until that put settles
