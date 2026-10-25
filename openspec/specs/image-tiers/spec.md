# image-tiers Specification

## Purpose

Chooses disposable preview bytes for the pasteboard without putting original photos in the page. Interactive sizes are a filmstrip thumbnail and one working pasteboard preview.

## Requirements

### Requirement: Two preview sizes only

The system SHALL use exactly two disposable preview sizes: a filmstrip thumbnail (long edge 320) and one working pasteboard preview (long edge 1280). It MUST NOT encode or select 640 or 2560 zoom ladder steps. Original image bytes MUST NOT be placed in the document DOM. Quality loss when the on-screen long edge times DPR exceeds 1280 is acceptable.

#### Scenario: Pasteboard always requests the working preview

- **WHEN** a filled frame needs a zoom/preview source
- **THEN** the chosen working tier is 1280

#### Scenario: Filmstrip uses the thumbnail size

- **WHEN** a gallery card needs a thumbnail
- **THEN** the encode long-edge cap is 320

### Requirement: Progressive thumb then working preview

While the working 1280 preview is not yet decoded for display, a filled frame MUST show the best available lower source already on hand (hot working URL miss → filmstrip thumb) and MUST NOT render as an empty placeholder solely because the working preview is still loading. After the working preview finishes decode, the frame MUST switch to it without an empty flash.

#### Scenario: Thumb shows before working decode

- **WHEN** the working preview URL is not ready and a filmstrip thumb URL exists
- **THEN** the frame shows the thumb instead of a blank placeholder

#### Scenario: Working preview replaces the provisional source

- **WHEN** the 1280 preview finishes decode while a thumb is shown
- **THEN** the frame switches to the working preview without an empty flash

### Requirement: Tier object URLs stay bounded

Working-preview object URLs MUST live in a bounded cache and MUST be revoked when evicted. The system MUST publish at most one new preview object URL per animation frame.

#### Scenario: Eviction revokes the URL

- **WHEN** the cache exceeds its capacity and an older preview is evicted
- **THEN** that preview's object URL is revoked

### Requirement: Working preview encode stays off the main thread

A missing working preview MUST be encoded in a worker from the session file (including resize during `createImageBitmap` when supported). The main thread MUST NOT decode or resize the original to produce that preview. When both the filmstrip thumbnail and the working preview are missing for the same original, the worker MUST decode the original at most once and produce both disposable tiers in that job.

#### Scenario: Missing preview is encoded in the worker

- **WHEN** the working preview is not cached and a session file exists for the asset
- **THEN** the preview bytes are produced by the photo worker at long edge 1280

#### Scenario: One decode yields thumb and working preview

- **WHEN** both thumb320 and working-preview-1280 are missing and a dual-tier encode runs
- **THEN** the original is decoded once and both tiers are produced from that decode

### Requirement: Decode before swap

While a camera gesture is active, a frame that already shows an image MUST keep that image source. After the gesture settles, the system MUST finish decoding the working preview before replacing the displayed source, and MUST NOT flash an empty placeholder in between.

#### Scenario: Gesture keeps the current source

- **WHEN** a zoom gesture is in progress on a frame that already shows an image
- **THEN** that frame's image source does not change

#### Scenario: Swap waits for decode

- **WHEN** a new working preview is ready after the gesture settles and its decode has not finished
- **THEN** the frame still shows the previous image

### Requirement: Cancelling a preview job does not abort import

Cancelling a working-preview or off-screen thumb job MUST NOT abort an in-flight gallery import batch. Per-asset abort MUST allow re-enqueue when the asset re-enters the now set.

#### Scenario: Import still completes

- **WHEN** a working-preview request is cancelled while an import of files is still running
- **THEN** that import still completes

#### Scenario: Scroll-out cancel can retry

- **WHEN** a thumb job is aborted because the asset left the now set and later re-enters it without a hot thumb
- **THEN** a new now-priority encode is queued

### Requirement: Session files stay out of the book

Files kept so previews can be encoded MUST NOT be stored in the book document.

#### Scenario: Serialized book has ids only

- **WHEN** a photo has been imported and a working preview has been generated
- **THEN** the serialized book references the asset by id and does not contain the file

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

### Requirement: Disposable tiers encode as WebP

Newly encoded filmstrip thumbnails and working previews MUST be `image/webp` (quality about 0.8). Source MIME MUST NOT force JPEG output for new encodes.

#### Scenario: JPEG source yields WebP tiers

- **WHEN** a JPEG original is dual-tier encoded
- **THEN** both thumb320 and working-preview buffers report `image/webp`

### Requirement: Decode pool raises concurrency during import

While a gallery import is running, the decode worker pool MAY use a higher concurrency cap (target 6–8) than the idle/browse cap. Under longtask or memory pressure the effective limit MUST still back off (half / floor 1). Idle/browse MUST keep the safer lower cap.

#### Scenario: Import concurrency exceeds idle

- **WHEN** import is running and there is no memory/longtask pressure
- **THEN** the effective decode slot limit is higher than the idle/browse cap and at most the import-time maximum

#### Scenario: Pressure still backs off

- **WHEN** decode reports memory or longtask pressure during import
- **THEN** effective concurrency drops per the existing backoff rules (memory → 1; longtask → half, floor 1)
