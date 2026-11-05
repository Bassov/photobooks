## MODIFIED Requirements

### Requirement: On-disk library layout and durable book writes

The File System Access adapter SHALL persist library metadata and books using the library folder layout: `library.json` at the library root and `books/<bookId>/book.json` per book. Book writes MUST use a writable stream commit and rotate the previous book file to `book.json.bak` before replacing `book.json`. Creating a book MUST create its book directory. Deleting a book MUST remove that book's directory contents from the library. `library.json` MUST carry `schemaVersion` (currently 4), a `books` map of book id → `{ status: 'draft' | 'published' }`, a `templates` list of saved layouts `{ id, name, pages: 1 | 2, slots }` in save order, a `printProfiles` list of custom printer profiles and `defaultPrintProfileId` (default `generic`); a file without `schemaVersion` is v0, v0 / v1 files upgrade on read with an empty `books` map, v0–v2 files upgrade with an empty `templates` list and v0–v3 files with no custom profiles and the `generic` default. A file with a newer version MUST fail reads and writes with `newer-schema`, and a file whose `books` map is invalid MUST fail reads and writes with `corrupted`; neither is overwritten. An invalid `templates` or `printProfiles` entry (or a custom profile reusing a built-in id) MUST be dropped on its own (a non-list reads as empty) without failing the read. Creating a library in a folder that already has a `library.json` MUST keep its `books` map, `templates`, `printProfiles` and default. A new book SHALL use the library's default profile (unknown → `generic`) and its bleed and safe margin.

#### Scenario: Create writes library layout files

- **WHEN** a book is created through the File System Access adapter
- **THEN** `books/<bookId>/book.json` exists under the library directory and listing (derived from `books/` directories, not from `library.json`) includes that book id

#### Scenario: Save rotates bak then writes book.json

- **WHEN** an existing book is saved through the File System Access adapter
- **THEN** the previous `book.json` content is preserved as `book.json.bak` and the new content is stored as `book.json`

#### Scenario: Delete removes the book directory

- **WHEN** an existing book is deleted through the File System Access adapter
- **THEN** that book's directory under `books/` is gone and load returns `not-found`

#### Scenario: One invalid template is dropped

- **WHEN** a v3 `library.json` lists three templates and the second has `pages: 3`
- **THEN** the read succeeds with the first and third templates in their order
