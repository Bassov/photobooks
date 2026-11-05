# image-derivatives Specification

## Purpose

Encodes web derivatives (resized JPEG / WebP) of library photos for the site, off the main thread, cached in `DerivedCache` and scheduled behind every interactive image job.

## Requirements

### Requirement: Web derivative presets

The system SHALL define web derivative presets as config (id, long-edge px, JPEG or WebP, quality): `site-thumb` 480 px WebP 0.80, `site-display` 1600 px WebP 0.85, `site-large` 3200 px WebP 0.90 and `site-share` 1600 px JPEG 0.90. Display and share qualities are the lowest that pass the derivative lab bar at their edge and format: luma SSIM ≥ 0.97 on every lab fixture and a band step ≤ 1.5 levels on the sky gradient. No WebP quality passes at 3200 px (shadows SSIM stays below the bar at every quality); `site-large` stays WebP for the WebP-only site srcset at 0.90, the only quality that passes the sky and foliage fixtures there. A derivative fits the source long edge into the preset edge without upscaling, applies EXIF orientation and is encoded as sRGB.

#### Scenario: Large source

- **WHEN** a 6000×4000 source is derived with a 1600 px WebP preset
- **THEN** the output is a 1600×1067 `image/webp`

#### Scenario: Derivative lab

- **WHEN** the dev-only derivative lab (test builds only, never deployed) encodes the generated sky, shadows and foliage fixtures in its worker at 1600 / 2048 / 3200 px with WebP 0.75–0.90 and JPEG 0.80–0.90
- **THEN** every variant decodes and shows its bytes, SSIM and band step, and the lowest passing quality per edge and format is listed

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
