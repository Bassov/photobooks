## MODIFIED Requirements

### Requirement: Preview bytes use derived cache when identity is complete

When an asset has complete durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`), the system SHALL persist generated working-preview bytes in the derived cache under the identity digest and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When identity is incomplete, preview caching MUST remain memory-only (hot object-URL LRU) without writing fabricated keys. Whole-file `contentHash` MUST NOT be required for put or hydrate. Thumb320 generation for filmstrip MUST prioritize visible and book-used assets; remaining gallery entries MAY stay without a 320 preview until needed. JPEG and HEIC/HEIF sources MUST NOT receive prefetch or background full-original decode / thumb320 / working-preview encode while outside visible ∪ book-used; entering that set queues encode at now priority. Bulk/prefetch import MUST encode thumb320 only and MUST defer working-preview-1280 until placement, pasteboard need, or a later dual-tier/idle job. A temporary EXIF embedded JPEG thumbnail (from a head pass) is not a derived-cache tier and MUST NOT be written under thumb320 or working-preview preset ids. New tier encodes MUST use `image/webp`; existing derived-cache rows with other MIME types MUST still hydrate for display.

#### Scenario: Identity-complete asset hydrates working preview from derived cache

- **WHEN** the hot working-preview URL is missing, the asset has a complete identity, and the derived cache already holds the working-preview preset for that identity digest
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Identity-complete asset stores working preview after encode

- **WHEN** the working preview is encoded for an asset that has a complete identity
- **THEN** those preview bytes are put into the derived cache under the identity digest and the working-preview preset id as `image/webp`

#### Scenario: Legacy JPEG derived-cache row still hydrates

- **WHEN** DerivedCache holds a working-preview or thumb preset whose stored MIME is `image/jpeg`
- **THEN** hydrate publishes a hot object URL from those bytes without requiring a WebP re-encode first

#### Scenario: Incomplete identity skips derived cache

- **WHEN** the working preview or thumb320 is encoded for an asset without complete identity
- **THEN** the system does not put a derived-cache entry under a fabricated key

#### Scenario: Idle gallery entries defer thumb320

- **WHEN** many gallery assets are placeholders and only a subset are visible or book-used
- **THEN** thumb320 encode runs for the visible/book-used subset first and idle entries may remain without a 320 preview

#### Scenario: Idle JPEG or HEIC never background-encodes

- **WHEN** a JPEG or HEIC/HEIF asset is only an off-window unused placeholder
- **THEN** no full-original decode or thumb320/working-preview encode job is queued for it until it becomes visible or book-used

#### Scenario: Bulk import defers working-preview-1280

- **WHEN** a bulk/prefetch import encodes a gallery thumb for an asset that is not yet needed on the pasteboard
- **THEN** the job produces thumb320 only and does not encode working-preview-1280 in that job

## ADDED Requirements

### Requirement: Decode pool raises concurrency during import

While a gallery import is running, the decode worker pool MAY use a higher concurrency cap (target 6–8) than the idle/browse cap. Under longtask or memory pressure the effective limit MUST still back off (half / floor 1). Idle/browse MUST keep the safer lower cap. With lazy JPEG, most decode work is deferred until visible ∪ book-used; the import ceiling still applies to work that runs while import UX is active (including visible promotes during that window).

#### Scenario: Import concurrency exceeds idle

- **WHEN** import is running and there is no memory/longtask pressure
- **THEN** the effective decode slot limit is higher than the idle/browse cap and at most the import-time maximum

#### Scenario: Pressure still backs off

- **WHEN** decode reports memory or longtask pressure during import
- **THEN** effective concurrency drops per the existing backoff rules (memory → 1; longtask → half, floor 1)
