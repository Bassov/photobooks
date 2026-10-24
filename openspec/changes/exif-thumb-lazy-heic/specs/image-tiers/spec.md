## MODIFIED Requirements

### Requirement: Working preview cache and thumb priority

When an asset has complete durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`), the system SHALL persist generated working-preview bytes in the derived cache under the identity digest and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When identity is incomplete, preview caching MUST remain memory-only (hot object-URL LRU) without writing fabricated keys. Whole-file `contentHash` MUST NOT be required for put or hydrate. Thumb320 generation for filmstrip MUST prioritize visible and book-used assets; remaining gallery entries MAY stay without a 320 preview until needed. HEIC/HEIF sources MUST NOT receive prefetch or background thumb320/working-preview encode while outside visible ∪ book-used; entering that set queues encode at visible priority. A temporary EXIF embedded JPEG thumbnail (from a head pass) is not a derived-cache tier and MUST NOT be written under thumb320 or working-preview preset ids.

#### Scenario: Identity-complete asset stores working preview after encode

- **WHEN** the working preview is encoded for an asset that has a complete identity
- **THEN** those preview bytes are put into the derived cache under the identity digest and the working-preview preset id

#### Scenario: Incomplete identity skips derived cache

- **WHEN** the working preview or thumb320 is encoded for an asset without complete identity
- **THEN** the system does not put a derived-cache entry under a fabricated key

#### Scenario: Idle gallery entries defer thumb320

- **WHEN** many gallery assets are placeholders and only a subset are visible or book-used
- **THEN** thumb320 encode runs for the visible/book-used subset first and idle entries may remain without a 320 preview

#### Scenario: Idle HEIC never background-encodes

- **WHEN** a HEIC/HEIF asset is only an off-window unused placeholder
- **THEN** no thumb320 or working-preview encode job is queued for it until it becomes visible or book-used
