## MODIFIED Requirements

### Requirement: On-disk library layout and durable book writes

The File System Access adapter SHALL persist library metadata and books using the library folder layout: `library.json` at the library root and `books/<bookId>/book.json` per book. Book writes MUST use a writable stream commit and rotate the previous book file to `book.json.bak` before replacing `book.json`. Creating a book MUST create its book directory. Deleting a book MUST remove that book's directory contents from the library. `library.json` MUST carry `schemaVersion` (currently 2) and a `books` map of book id → `{ status: 'draft' | 'published' }`; a file without `schemaVersion` is v0, and v0 / v1 files upgrade on read to v2 with an empty `books` map. A file with a newer version MUST fail reads and writes with `newer-schema`, and a v2 file whose `books` map is invalid MUST fail reads and writes with `corrupted`; neither is overwritten. Creating a library in a folder that already has a `library.json` MUST keep its `books` map.

#### Scenario: Create writes library layout files

- **WHEN** a book is created through the File System Access adapter
- **THEN** `books/<bookId>/book.json` exists under the library directory and listing (derived from `books/` directories, not from `library.json`) includes that book id

#### Scenario: Save rotates bak then writes book.json

- **WHEN** an existing book is saved through the File System Access adapter
- **THEN** the previous `book.json` content is preserved as `book.json.bak` and the new content is stored as `book.json`

#### Scenario: Delete removes the book directory

- **WHEN** an existing book is deleted through the File System Access adapter
- **THEN** that book's directory under `books/` is gone and load returns `not-found`

## ADDED Requirements

### Requirement: Draft and published book revisions

A book SHALL be `draft` unless its `library.json` entry says `published`. Publishing a book MUST set its status to `published` and produce a `published.json` revision (`schemaVersion` 1, book id, publish time, a deep copy of the book) that later edits to the draft book never change; publishing again replaces the revision. Unpublishing MUST set the status to `draft` without deleting the revision. A `published.json` document MUST parse through book validation and fail with `newer-schema` or `corrupted` otherwise. The assets needed for the site SHALL be the deduplicated ids, in reading order, of assets the revision shows: cover panels, endpapers when enabled, and every spread's resolved frames (parent, overrides, own); ids missing from the asset map are skipped.

#### Scenario: Later edits leave the revision unchanged

- **WHEN** a book is published and the draft book is then edited
- **THEN** the revision still equals the book as it was at publish time and the status stays `published`

#### Scenario: Site assets come from the revision only

- **WHEN** an asset is in the gallery but placed nowhere in the published revision, or placed only after publishing
- **THEN** it is not among the assets needed for the site, and an asset placed several times is listed once
