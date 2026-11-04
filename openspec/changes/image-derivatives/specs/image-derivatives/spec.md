## ADDED Requirements

### Requirement: Web derivative presets

The system SHALL define web derivative presets as config (id, long-edge px, JPEG or WebP, quality); a derivative fits the source long edge into the preset edge without upscaling, applies EXIF orientation and is encoded as sRGB.

#### Scenario: Large source

- **WHEN** a 6000×4000 source is derived with a 1600 px WebP preset
- **THEN** the output is a 1600×1067 `image/webp`

### Requirement: Deterministic cached derivatives

The system SHALL cache each derivative in `DerivedCache` under `(assetHash, presetCacheId)`, where the cache id changes whenever the preset edge, format or quality changes; deriving the same source with the same preset twice SHALL yield the same output hash.

#### Scenario: Second request hits the cache

- **WHEN** derivatives already cached for an asset are requested again
- **THEN** no encode runs and every result reports a cache hit

### Requirement: Lowest-priority derivative jobs

The system SHALL encode derivatives off the main thread and start a derivative job only while no thumb / editor-tier decode job is queued, no metadata job runs and the filmstrip scroll-quiet window is closed; jobs run in request order, presets in config order.

#### Scenario: Drag while derivatives encode

- **WHEN** the user drags a frame while derivatives encode
- **THEN** the interaction records zero long animation frames
