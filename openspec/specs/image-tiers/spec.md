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

A missing working preview MUST be encoded in a worker from the session file (including resize during `createImageBitmap` when supported). The main thread MUST NOT decode or resize the original to produce that preview.

#### Scenario: Missing preview is encoded in the worker

- **WHEN** the working preview is not cached and a session file exists for the asset
- **THEN** the preview bytes are produced by the photo worker at long edge 1280

### Requirement: Decode before swap

While a camera gesture is active, a frame that already shows an image MUST keep that image source. After the gesture settles, the system MUST finish decoding the working preview before replacing the displayed source, and MUST NOT flash an empty placeholder in between.

#### Scenario: Gesture keeps the current source

- **WHEN** a zoom gesture is in progress on a frame that already shows an image
- **THEN** that frame's image source does not change

#### Scenario: Swap waits for decode

- **WHEN** a new working preview is ready after the gesture settles and its decode has not finished
- **THEN** the frame still shows the previous image

### Requirement: Cancelling a preview job does not abort import

Cancelling a working-preview job MUST NOT abort an in-flight gallery import.

#### Scenario: Import still completes

- **WHEN** a working-preview request is cancelled while an import of files is still running
- **THEN** that import still completes

### Requirement: Session files stay out of the book

Files kept so previews can be encoded MUST NOT be stored in the book document.

#### Scenario: Serialized book has ids only

- **WHEN** a photo has been imported and a working preview has been generated
- **THEN** the serialized book references the asset by id and does not contain the file

### Requirement: Preview bytes use derived cache when hashed

When an asset has a known `contentHash` (produced off the import/rescan hot path), the system SHALL persist generated working-preview bytes in the derived cache under that hash and the working-preview preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before encoding from the session file. When `contentHash` is absent — the default after list-first import/rescan — preview caching MUST remain memory-only (hot object-URL LRU) without writing fake hash keys. Thumb320 generation for filmstrip MUST prioritize visible and book-used assets; remaining gallery entries MAY stay without a 320 preview until needed.

#### Scenario: Hashed asset hydrates working preview from derived cache

- **WHEN** the hot working-preview URL is missing, the asset has a `contentHash`, and the derived cache already holds the working-preview preset
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Hashed asset stores working preview after encode

- **WHEN** the working preview is encoded for an asset that has a `contentHash`
- **THEN** those preview bytes are put into the derived cache under that hash and the working-preview preset id

#### Scenario: Unhashed asset skips derived cache

- **WHEN** the working preview or thumb320 is encoded for an asset without a `contentHash`
- **THEN** the system does not put a derived-cache entry under a fabricated hash

#### Scenario: Idle gallery entries defer thumb320

- **WHEN** many gallery assets are placeholders and only a subset are visible or book-used
- **THEN** thumb320 encode runs for the visible/book-used subset first and idle entries may remain without a 320 preview
