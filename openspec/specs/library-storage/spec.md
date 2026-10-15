# library-storage Specification

## Purpose

Defines the domain library persistence contract: listing and mutating books and library metadata through typed results, with a memory adapter proven by a shared contract suite for later platform adapters.

## Requirements

### Requirement: Domain library storage API

The system SHALL expose a domain library storage API that lists books, creates/loads/saves/deletes books, and reads/updates library metadata using domain types only. The API MUST NOT accept or return file paths, raw bytes, or platform handles.

#### Scenario: Empty library lists no books

- **WHEN** a new memory library storage is created
- **THEN** listing books returns an empty list and library metadata is available

#### Scenario: Create then list

- **WHEN** a valid book is created in library storage
- **THEN** listing books includes a summary for that book id

#### Scenario: Save then load round-trip

- **WHEN** an existing book is saved with updated document fields and then loaded by id
- **THEN** the loaded book equals the saved book for all document fields

#### Scenario: Delete removes the book

- **WHEN** an existing book is deleted
- **THEN** listing no longer includes it and loading that id fails with `not-found`

#### Scenario: Library metadata replace

- **WHEN** library metadata is updated
- **THEN** a subsequent get returns exactly the metadata that was written (full replace)

### Requirement: Typed storage results

Library storage operations SHALL return typed success or failure results. Failure codes MUST include: `permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`, and `already-exists`. Callers MUST be able to distinguish these codes without inspecting thrown platform errors. Creating a book whose id already exists MUST fail with `already-exists`. Saving or deleting a missing id MUST fail with `not-found`.

#### Scenario: Missing book is not-found

- **WHEN** a caller loads, saves, or deletes a book id that is not in the library
- **THEN** the result is a typed failure with code `not-found`

#### Scenario: Duplicate create is already-exists

- **WHEN** a caller creates a book whose id is already in the library
- **THEN** the result is a typed failure with code `already-exists`

#### Scenario: Corrupted book is corrupted

- **WHEN** stored book data cannot be interpreted as a valid book document
- **THEN** load fails with typed code `corrupted`

#### Scenario: Unsupported newer schema is newer-schema

- **WHEN** stored book data declares a `schemaVersion` greater than the supported version
- **THEN** load fails with typed code `newer-schema`

#### Scenario: Permission required blocks all operations

- **WHEN** the adapter requires permission
- **THEN** every library storage operation fails with typed code `permission-required`

#### Scenario: Lock blocks mutations only

- **WHEN** the adapter reports the library is locked elsewhere
- **THEN** create, save, delete, and library-metadata update fail with `locked-elsewhere`, while list/load/get still succeed

### Requirement: Shared contract suite and memory adapter

The system SHALL provide an in-memory library storage adapter and a shared contract-test suite that exercises the domain API and every typed failure code against that adapter. The suite MUST accept an adapter factory so a future File System Access adapter can reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code

### Requirement: Project module boundary

Library storage code SHALL live under `src/project` and MUST NOT import React or DOM UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/project`.

#### Scenario: Core stays independent of project

- **WHEN** dependency cruiser runs
- **THEN** no `src/core` module depends on `src/project`
