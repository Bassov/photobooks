## ADDED Requirements

### Requirement: Library-backed import streams identity before body reads

When importing into a library-backed book, the system SHALL enqueue gallery placeholders and start decode from cheap file identity fields (`relativePath`, size, mtime) without waiting for every selected file's body to be read. Reading bytes for library seed and content hash MUST run per file with at most sixteen body reads in flight at once. The system MUST NOT block the whole selection behind a single all-files body-read barrier on the main thread.

#### Scenario: Placeholders appear before body reads finish

- **WHEN** the user imports multiple supported images into a library-backed book and body reads are slow or pending
- **THEN** gallery placeholders and import progress are visible while at least one accepted file's body has not finished reading

#### Scenario: Body reads are capped

- **WHEN** more than sixteen files are imported into a library-backed book
- **THEN** at most sixteen `arrayBuffer` (or equivalent body) reads are in flight at any moment during that import

### Requirement: Session-to-library upgrade caps body reads

When upgrading session-only gallery assets into library identity, the system MUST read file bodies with at most sixteen reads in flight and MUST NOT block the whole upgrade set behind a single all-files body-read barrier.

#### Scenario: Upgrade reads are capped

- **WHEN** more than sixteen session assets are upgraded into a library
- **THEN** at most sixteen body reads are in flight at any moment during that upgrade

### Requirement: Re-import reuses matching assets and restores thumbnails

Re-importing files that already belong to the book (same relative path, byte size, and mtime, or matching content hash) MUST NOT create duplicate gallery entries. The system MUST reuse the existing asset ids and MUST restore orientation-corrected thumbnails for those assets when DerivedCache entries were missing.

#### Scenario: Re-import keeps gallery count and asset ids

- **WHEN** the user re-imports the same N already-imported photos into a library-backed book after clearing thumbnail cache entries
- **THEN** the gallery still contains exactly those N assets with the same asset ids and thumbnails become available again

### Requirement: Library bulk re-import meets progressive and frame budgets

A library-backed re-import of ~200 already-imported photos with an empty thumbnail cache MUST expose import progress and a non-zero gallery count within the same progressive deadlines used for fresh bulk import, and MUST keep the scroll-during-import window within the project's LoAF, hot-handler p95, and INP budgets.

#### Scenario: Library re-import progressive first card

- **WHEN** ~200 already-imported photos are re-imported into a library-backed book with an empty thumbnail cache
- **THEN** import progress shows an importing state and the gallery count is greater than zero while the import is still running, within the fresh-import progressive deadlines, and time to the first gallery card is at most 1.5× a session-path import measured in the same run

#### Scenario: Library re-import scroll stays within frame budgets

- **WHEN** the filmstrip is scrolled during that library-backed bulk re-import under calibrated CPU throttling
- **THEN** the scroll-during-import window records zero LoAF entries, hot-handler p95 stays within `handlerP95Ms × cpuThrottleRate`, and INP stays within the shared INP budget
