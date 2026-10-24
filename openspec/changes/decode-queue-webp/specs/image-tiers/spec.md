## MODIFIED Requirements

### Requirement: Working preview encode stays off the main thread

A missing working preview MUST be encoded in a worker from the session file (including resize during `createImageBitmap` when supported). The main thread MUST NOT decode or resize the original to produce that preview. When both the filmstrip thumbnail and the working preview are missing for the same original, the worker MUST decode the original at most once and produce both disposable tiers in that job.

#### Scenario: Missing preview is encoded in the worker

- **WHEN** the working preview is not cached and a session file exists for the asset
- **THEN** the preview bytes are produced by the photo worker at long edge 1280

#### Scenario: One decode yields thumb and working preview

- **WHEN** both thumb320 and working-preview-1280 are missing and a dual-tier encode runs
- **THEN** the original is decoded once and both tiers are produced from that decode

### Requirement: Cancelling a preview job does not abort import

Cancelling a working-preview or off-screen thumb job MUST NOT abort an in-flight gallery import batch. Per-asset abort MUST allow re-enqueue when the asset re-enters the now set.

#### Scenario: Import still completes

- **WHEN** a working-preview request is cancelled while an import of files is still running
- **THEN** that import still completes

#### Scenario: Scroll-out cancel can retry

- **WHEN** a thumb job is aborted because the asset left the now set and later re-enters it without a hot thumb
- **THEN** a new now-priority encode is queued

### Requirement: Preview bytes use derived cache when identity is complete

When an asset has complete durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`), the system SHALL persist generated working-preview bytes in the derived cache under the identity digest and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When identity is incomplete, preview caching MUST remain memory-only (hot object-URL LRU) without writing fabricated keys. Whole-file `contentHash` MUST NOT be required for put or hydrate. Thumb320 generation for filmstrip MUST prioritize visible and book-used assets; remaining gallery entries MAY stay without a 320 preview until needed. HEIC/HEIF sources MUST NOT receive prefetch or background thumb320/working-preview encode while outside visible ∪ book-used; entering that set queues encode at now priority. A temporary EXIF embedded JPEG thumbnail (from a head pass) is not a derived-cache tier and MUST NOT be written under thumb320 or working-preview preset ids. New tier encodes MUST use `image/webp`; existing derived-cache rows with other MIME types MUST still hydrate for display.

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

#### Scenario: Idle HEIC never background-encodes

- **WHEN** a HEIC/HEIF asset is only an off-window unused placeholder
- **THEN** no thumb320 or working-preview encode job is queued for it until it becomes visible or book-used

## ADDED Requirements

### Requirement: Disposable tiers encode as WebP

Newly encoded filmstrip thumbnails and working previews MUST be `image/webp` (quality about 0.8). Source MIME MUST NOT force JPEG output for new encodes.

#### Scenario: JPEG source yields WebP tiers

- **WHEN** a JPEG original is dual-tier encoded
- **THEN** both thumb320 and working-preview buffers report `image/webp`
