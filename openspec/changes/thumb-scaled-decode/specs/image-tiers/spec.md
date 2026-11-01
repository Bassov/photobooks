## MODIFIED Requirements

### Requirement: Working preview encode stays off the main thread

A missing working preview MUST be encoded in a worker from the session file. For JPEG sources, when `ImageDecoder` exists and supports `image/jpeg`, the worker MUST read only a bounded head (≤64 KiB) for SOF size and EXIF orientation and decode the streamed file with `ImageDecoder` at a reduced desired size that still covers the target long edge (no full-file body read unless the body is returned for library seed); the EXIF transform MUST be applied exactly once (by the decoded frame or by hand, never both). Other formats, a missing `ImageDecoder`, or a failing decode MUST fall back to `createImageBitmap` (with resize when supported). The main thread MUST NOT decode or resize the original to produce that preview. When both the filmstrip thumbnail and the working preview are missing for the same original, the worker MUST decode the original at most once and produce both disposable tiers in that job.

#### Scenario: Missing preview is encoded in the worker

- **WHEN** the working preview is not cached and a session file exists for the asset
- **THEN** the preview bytes are produced by the photo worker at long edge 1280

#### Scenario: One decode yields thumb and working preview

- **WHEN** both thumb320 and working-preview-1280 are missing and a dual-tier encode runs
- **THEN** the original is decoded once and both tiers are produced from that decode

#### Scenario: JPEG decodes at reduced scale

- **WHEN** the worker encodes thumb320 for a 6000x4000 JPEG and `ImageDecoder` supports JPEG
- **THEN** it decodes a frame at a reduced scale no smaller than the target, does not read the full file body, and the thumb long edge is 320

#### Scenario: Oriented once

- **WHEN** a JPEG with EXIF orientation 3, 6 or 8 is decoded by `ImageDecoder`
- **THEN** the thumb and working preview are upright (not unrotated and not rotated twice)

#### Scenario: Fallback when ImageDecoder fails

- **WHEN** `ImageDecoder` is missing or throws for a JPEG, or the source is PNG / WebP / HEIC
- **THEN** the worker decodes with `createImageBitmap` as before
