## MODIFIED Requirements

### Requirement: Library-backed import streams identity before body reads

When importing into a library-backed book, the system SHALL enqueue gallery placeholders from cheap scan identity fields (`relativePath`, size, mtime) without waiting for file bodies. Reading bytes for library seed and thumb320 decode MUST run per prioritized file with at most sixteen body reads in flight at once. The system MUST NOT block the whole selection behind a single all-files body-read barrier on the main thread. Content-hash MUST NOT be required on this hot path.

#### Scenario: Placeholders appear before body reads finish

- **WHEN** the user imports multiple supported images into a library-backed book and body reads are slow or pending
- **THEN** gallery placeholders and import progress are visible while at least one accepted file's body has not finished reading

#### Scenario: Body reads are capped

- **WHEN** more than sixteen files need body reads during library-backed import decode
- **THEN** at most sixteen `arrayBuffer` (or equivalent body) reads are in flight at any moment during that import

### Requirement: Re-import reuses matching assets and restores thumbnails

Re-importing files that already belong to the book (same relative path, byte size, and mtime) MUST NOT create duplicate gallery entries. The system MUST reuse the existing asset ids and MUST restore orientation-corrected thumbnails for those assets when in-session or derived thumbs were missing. Matching content hash MUST NOT be required for reuse.

#### Scenario: Re-import keeps gallery count and asset ids

- **WHEN** the user re-imports the same N already-imported photos into a library-backed book after clearing thumbnail cache entries
- **THEN** the gallery still contains exactly those N assets with the same asset ids and thumbnails become available again
