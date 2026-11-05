## ADDED Requirements

### Requirement: Published revision storage

`LibraryStorage` SHALL save and load a book's published revision (`savePublished(revision)`, `loadPublished(bookId)`) as `books/<id>/published.json` in the FSA adapter and in memory in the memory adapter; a missing revision loads as `not-found`, an invalid one as `corrupted` or `newer-schema`, and deleting the book deletes its revision.

#### Scenario: Round trip

- **WHEN** a revision is saved and loaded again in either adapter
- **THEN** the loaded revision equals the saved one, and editing the draft book afterwards leaves it unchanged
