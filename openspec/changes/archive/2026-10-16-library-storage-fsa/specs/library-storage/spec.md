# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Shared contract suite and memory adapter

The system SHALL provide an in-memory library storage adapter and a shared contract-test suite that exercises the domain API and every typed failure code against that adapter. The suite MUST accept an adapter factory so both the memory adapter and the File System Access adapter can reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code
