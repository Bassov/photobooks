# image-tiers Specification

## Purpose

Chooses the smallest cached preview that stays sharp at the current camera zoom, without putting original photos in the page.

## Requirements

### Requirement: Smallest covering tier

The system SHALL choose the smallest long edge among 320, 640, 1280, and 2560 pixels that covers the frame's on-screen long edge times device pixel ratio. When none covers, it MUST use 2560. Original image bytes MUST NOT be placed in the document DOM.

#### Scenario: Mid size picks the covering step

- **WHEN** the on-screen long edge times device pixel ratio is greater than 320 and at most 640
- **THEN** the chosen tier is 640

#### Scenario: Above the ladder uses the largest tier

- **WHEN** the covered size is greater than 2560
- **THEN** the chosen tier is 2560

### Requirement: Tier object URLs stay bounded

Tier object URLs MUST live in a bounded cache and MUST be revoked when evicted. The system MUST publish at most one new tier object URL per animation frame.

#### Scenario: Eviction revokes the URL

- **WHEN** the cache exceeds its capacity and an older tier is evicted
- **THEN** that tier's object URL is revoked

### Requirement: Tier encode stays off the main thread

A missing tier MUST be encoded in a worker from the session file. The main thread MUST NOT decode or resize the original to produce that tier.

#### Scenario: Missing tier is encoded in the worker

- **WHEN** the covering tier is not cached and a session file exists for the asset
- **THEN** the preview bytes are produced by the photo worker at that tier's long edge

### Requirement: Decode before swap

While a camera gesture is active, a frame that already shows an image MUST keep that image source. After the gesture settles, the system MUST finish decoding the next tier before replacing the displayed source, and MUST NOT flash an empty placeholder in between.

#### Scenario: Gesture keeps the current source

- **WHEN** a zoom gesture is in progress on a frame that already shows an image
- **THEN** that frame's image source does not change

#### Scenario: Swap waits for decode

- **WHEN** a new tier is ready after the gesture settles and its decode has not finished
- **THEN** the frame still shows the previous image

### Requirement: Cancelling a tier does not abort import

Cancelling a zoom-tier job MUST NOT abort an in-flight gallery import.

#### Scenario: Import still completes

- **WHEN** a zoom-tier request is cancelled while an import of files is still running
- **THEN** that import still completes

### Requirement: Session files stay out of the book

Files kept so tiers can be encoded MUST NOT be stored in the book document.

#### Scenario: Serialized book has ids only

- **WHEN** a photo has been imported and a tier has been generated
- **THEN** the serialized book references the asset by id and does not contain the file
