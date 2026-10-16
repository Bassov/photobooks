# asset-source Specification

## Purpose

Defines the domain contract for reading photo-folder originals, scanning source roots, computing content hashes off the main thread, and purely matching scanned files to book asset records for later open/save and relink flows.

## Requirements

### Requirement: Domain asset source API

The system SHALL expose a domain asset-source API that registers read-only source roots, lists scanned file entries for a root, and resolves an entry for hashing or identity updates using domain types only. The API MUST NOT accept or return filesystem handles. Relative paths MAY appear as domain strings that match asset-record `relativePath` values.

#### Scenario: Scan returns domain entries

- **WHEN** a source root is registered and scanned
- **THEN** the result lists entries with relative path, byte size, and mtime as domain fields without exposing a directory handle

#### Scenario: Handles stay off the domain API

- **WHEN** a caller uses only the domain asset-source API
- **THEN** no method parameter or return value is a File System Access directory or file handle

### Requirement: Typed asset source results

Asset-source operations SHALL return typed success or failure results. Failure codes MUST include at least `permission-required`, `not-found`, and `corrupted`. Callers MUST distinguish these codes without inspecting thrown platform errors.

#### Scenario: Missing root fails typed

- **WHEN** the caller scans or resolves against an unknown source root id
- **THEN** the operation fails with `not-found`

#### Scenario: Permission failure is typed

- **WHEN** the adapter cannot access a registered root because permission is required
- **THEN** the operation fails with `permission-required`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory asset-source adapter and a File System Access asset-source adapter. Both MUST pass one shared contract-test suite that exercises the domain API and every named failure code. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes contract suite

- **WHEN** the shared contract suite runs against the memory adapter
- **THEN** every suite case passes including each typed failure code

#### Scenario: File System Access adapter passes contract suite

- **WHEN** the shared contract suite runs against the File System Access adapter
- **THEN** every suite case passes including each typed failure code

### Requirement: Worker SHA-256 hashing

The system SHALL compute SHA-256 content hashes for asset bytes in a Web Worker. Hashing MUST NOT run as blocking work on the main thread. Digests MUST be returned as 64-character lowercase hexadecimal strings.

#### Scenario: Hash produced off main thread

- **WHEN** hashing is requested for file bytes that need a content hash
- **THEN** the digest is computed in a Web Worker and returned as a 64-character lowercase hexadecimal SHA-256 string

### Requirement: Size and mtime hash fast path

When an existing asset record already has a `contentHash` and matching `byteSize` and `mtimeMs` for the same source root and relative path, the system MUST reuse that hash and MUST NOT require a new full-file hash.

#### Scenario: Size and mtime skip full hash

- **WHEN** a scanned entry matches an asset record on source root id, relative path, byte size, and mtime, and that record already has a `contentHash`
- **THEN** the system reuses that hash without hashing the full file again

### Requirement: Lowest-priority hash scheduling

Hash jobs MUST be scheduled at the lowest priority in the shared asset worker pool so visible decode and preview jobs run first.

#### Scenario: Hash waits behind higher-priority work

- **WHEN** a visible or background decode/preview job and a hash job are queued together in the shared asset worker pool
- **THEN** the higher-priority job starts first and the hash job waits

### Requirement: Pure match and relink

The system SHALL expose a pure function that, given book asset records and a list of scanned domain entries (with optional content hashes), returns a match mapping from asset id to scanned entry (or unmatched). Matching MUST prefer equal `contentHash` when both sides have one. When hashes are absent, matching MAY use source root id, relative path, byte size, and mtime as a secondary key. The function MUST NOT perform I/O or touch platform handles.

#### Scenario: Hash match wins

- **WHEN** a scanned entry and an asset record share the same content hash
- **THEN** the match result pairs that asset id to that entry even if the relative path differs

#### Scenario: Path metadata fallback

- **WHEN** neither side has a usable content hash but source root id, relative path, byte size, and mtime all match
- **THEN** the match result pairs that asset id to that scanned entry

#### Scenario: No I/O in matcher

- **WHEN** the match function runs
- **THEN** it returns only derived match data and does not read files or use filesystem handles

### Requirement: Assets module boundary

Asset-source code SHALL live under `src/assets` and MUST NOT import React or DOM UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/assets`. The session `File` retain map under `src/photo` remains a separate concern and MUST NOT be the domain asset-source API.

#### Scenario: Core stays independent of assets

- **WHEN** dependency rules are evaluated
- **THEN** no `src/core` module depends on `src/assets`
