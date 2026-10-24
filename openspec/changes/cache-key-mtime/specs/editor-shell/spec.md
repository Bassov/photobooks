## MODIFIED Requirements

### Requirement: Adopt, upgrade assets, and create book

With a library open and no library-backed book id, the system SHALL adopt the in-memory book without clearing gallery/placements; if the same id exists on disk and the editor is empty, load the stored document. Adopt SHALL write durable identity (path/size/mtime/root) for session assets that still have originals so DerivedCache can key by identity digest. Create book MUST ask for a title before persist; cancel MUST NOT create; whitespace title stores empty (display Untitled). New book becomes active and is persisted under the library layout.

#### Scenario: Adopt then save keeps session work

- **WHEN** the user has session-only edits, creates a library, and saves
- **THEN** gallery and placements persist as the active library-backed book with identity for hydrate

### Requirement: Save, restore, and identity-keyed previews

Ctrl/Cmd+S (and chrome save) SHALL persist gallery/layout for a library-backed book; typed failures surface as non-blocking status without clearing memory. Reload with granted handle and in-tab active book id SHALL restore that book; without in-tab id but with granted handle, show library; with no usable handle, show welcome or unsupported; failed restore clears stale book state appropriately. After restore/save+reload, thumbnails and placed frames SHALL rehydrate from derived cache when durable identity is complete (thumb derivative MAY fill a missing zoom tier); landscape crop MUST NOT be square-forced. Books that only have legacy `contentHash`-keyed cache rows MAY miss once and regenerate. When gallery assets have durable identity but no live original `File` in session, the editor SHALL surface them via the missing-assets relink flow (pill + dialog) rather than silently treating them as permanently gone.

#### Scenario: Reload restores saved identity-keyed book

- **WHEN** an identity-complete library-backed book is saved and reloaded with a granted handle and in-tab id
- **THEN** gallery ids, placements, thumbs, and placed frames match the saved durable state without requiring `hashContent`

#### Scenario: Missing originals open relink UI

- **WHEN** a restored book has gallery assets with durable identity but no live session File for those assets
- **THEN** the missing-assets pill and relink dialog are available and the book stays editable
