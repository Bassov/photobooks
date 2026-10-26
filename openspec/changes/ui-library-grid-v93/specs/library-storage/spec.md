## MODIFIED Requirements

### Requirement: Domain library storage API

The system SHALL expose a domain library storage API that lists books, creates/loads/saves/deletes books, and reads/updates library metadata using domain types only. The API MUST NOT accept or return file paths, raw bytes, or platform handles. Book summaries SHALL include `id` and the book document `title`. When a listed book document parses successfully, the summary MUST also include `spreadCount` (number of spreads) and the page trim size as `pageWidthMm` / `pageHeightMm` from `settings.trim`. Corrupted or unreadable books MAY omit those optional fields while still listing `id` and `title` (empty title when unknown).

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

#### Scenario: Save then load round-trip

- **WHEN** an existing book is saved with updated document fields and then loaded by id
- **THEN** the loaded book equals the saved book for all document fields

#### Scenario: Delete removes the book

- **WHEN** an existing book is deleted
- **THEN** listing no longer includes it and loading that id fails with `not-found`

#### Scenario: Library metadata replace

- **WHEN** library metadata is updated
- **THEN** a subsequent get returns exactly the metadata that was written (full replace)
