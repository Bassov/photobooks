# library-storage Specification

## Purpose

Defines the domain library persistence contract: listing and mutating books and library metadata through typed results, with a memory adapter proven by a shared contract suite for later platform adapters.

## Requirements

### Requirement: Domain library storage API

The system SHALL expose a domain library storage API that lists books, creates/loads/saves/deletes books, and reads/updates library metadata using domain types only. The API MUST NOT accept or return file paths, raw bytes, or platform handles. Book summaries SHALL include `id` and the book document `title`. When a listed book document parses successfully, the summary MUST also include `spreadCount` (number of spreads) and the page trim size as `pageWidthMm` / `pageHeightMm` from `settings.trim`. When the adapter can observe a book document modification time, the summary MUST also include `editedAtMs` (UTC epoch milliseconds). Corrupted or unreadable books MAY omit optional enrichment fields while still listing `id` and `title` (empty title when unknown).

#### Scenario: Empty library lists no books

- **WHEN** a new memory library storage is created
- **THEN** listing books returns an empty list and library metadata is available

#### Scenario: Create then list

- **WHEN** a valid book is created in library storage
- **THEN** listing books includes a summary for that book id with the document `title`

#### Scenario: Listed summary carries document title

- **WHEN** a book with `title` `"Summer"` is created and books are listed
- **THEN** the summary for that book includes `title` `"Summer"`

#### Scenario: Listed summary carries spread count and page trim

- **WHEN** a valid book with N spreads and trim width/height is created and books are listed
- **THEN** the summary for that book includes `spreadCount` N and matching `pageWidthMm` / `pageHeightMm`

#### Scenario: Listed summary carries edited time when known

- **WHEN** a valid book is listed and the adapter knows its document modification time
- **THEN** the summary includes `editedAtMs` for that book

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

The system SHALL provide an in-memory library storage adapter and a shared contract-test suite that exercises the domain API and every typed failure code against that adapter. The suite MUST accept an adapter factory so both the memory adapter and the File System Access adapter can reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code

### Requirement: Project module boundary

Library storage code SHALL live under `src/project` and MUST NOT import React or DOM UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/project`.

#### Scenario: Core stays independent of project

- **WHEN** dependency cruiser runs
- **THEN** no `src/core` module depends on `src/project`

### Requirement: File System Access library storage adapter

The system SHALL provide a File System Access library storage adapter that implements the domain library storage API against a user-chosen library directory handle. The adapter MUST pass the shared contract-test suite without skipping a typed failure code. Directory handles and file paths MUST remain adapter-internal and MUST NOT appear on the domain API.

#### Scenario: FSA adapter passes the contract suite

- **WHEN** the contract suite runs with the File System Access adapter factory (including a test double for the directory handle in non-browser environments)
- **THEN** every case passes without skipping a typed failure code

#### Scenario: Domain API stays handle-free

- **WHEN** a caller uses the File System Access adapter through `LibraryStorage`
- **THEN** no method argument or success value exposes a directory handle, file path, or raw file bytes

### Requirement: On-disk library layout and durable book writes

The File System Access adapter SHALL persist library metadata and books using the library folder layout: `library.json` at the library root and `books/<bookId>/book.json` per book. Book writes MUST use a writable stream commit and rotate the previous book file to `book.json.bak` before replacing `book.json`. Creating a book MUST create its book directory. Deleting a book MUST remove that book's directory contents from the library.

#### Scenario: Create writes library layout files

- **WHEN** a book is created through the File System Access adapter
- **THEN** `books/<bookId>/book.json` exists under the library directory and listing (derived from `books/` directories, not from `library.json`) includes that book id

#### Scenario: Save rotates bak then writes book.json

- **WHEN** an existing book is saved through the File System Access adapter
- **THEN** the previous `book.json` content is preserved as `book.json.bak` and the new content is stored as `book.json`

#### Scenario: Delete removes the book directory

- **WHEN** an existing book is deleted through the File System Access adapter
- **THEN** that book's directory under `books/` is gone and load returns `not-found`

### Requirement: Worker-backed book load validation

The File System Access adapter SHALL perform parse, validate, and migrate of stored book JSON inside a Web Worker. The main thread MUST NOT run book parse/migrate for loads through this adapter. Parse failures MUST map to the same typed codes as the memory adapter (`corrupted`, `newer-schema`).

#### Scenario: Load validates in a worker

- **WHEN** a stored book is loaded through the File System Access adapter
- **THEN** parse/validate/migrate runs in a Web Worker and a valid book returns as a typed success

#### Scenario: Corrupt file yields corrupted

- **WHEN** `book.json` cannot be interpreted as a valid book document
- **THEN** load fails with typed code `corrupted`

### Requirement: Book serialization cost is benchmarked

The system SHALL include a vitest bench that serializes a 1000-asset book (same scale as the large-book core fixture) and records a time budget for that serialization. The bench MUST fail when the budget is exceeded.

#### Scenario: Serialize 1000-asset book within budget

- **WHEN** the serialization bench runs against a 1000-asset book
- **THEN** serialization completes within the recorded budget
