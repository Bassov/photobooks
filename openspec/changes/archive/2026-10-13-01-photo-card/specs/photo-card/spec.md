# Spec Delta

## Purpose

Lets the user open a single local image and see a photo card with corrected preview and basic file metadata, or a clear error for unsupported types.

## ADDED Requirements

### Requirement: Open a local image file

The system SHALL let the user choose one local image file. When the File System Access API is available, the system MUST prefer it. The system MUST also provide a file input path suitable for automated tests.

#### Scenario: Open via primary picker

- **WHEN** the user activates Open photo and the File System Access API is available
- **THEN** the system presents a file picker and loads the chosen image into the photo-card flow

#### Scenario: Open via file input fallback

- **WHEN** a supported image file is supplied through the hidden file input
- **THEN** the system loads that file into the same photo-card flow as the primary picker

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, and WebP images. The system MUST reject other types, including TIFF, and MUST show a visible error without rendering a success card.

#### Scenario: Accept JPEG

- **WHEN** the user opens an `image/jpeg` file
- **THEN** the system shows a photo card for that file

#### Scenario: Reject TIFF

- **WHEN** the user opens an `image/tiff` file
- **THEN** the system shows a visible unsupported-format error and does not show a success card

### Requirement: Photo card content

After a successful load, the system SHALL display one photo card that includes an orientation-corrected preview, corrected pixel dimensions, a reduced aspect-ratio label, and a human-readable file size.

#### Scenario: Card shows metadata

- **WHEN** a supported image loads successfully
- **THEN** the card shows corrected width×height, a reduced aspect ratio (for example `3:2`), and a byte size label using KB/MB/GB thresholds

#### Scenario: Preview respects EXIF orientation

- **WHEN** the image has a non-default EXIF orientation
- **THEN** the preview is displayed with that orientation applied so the subject appears upright

### Requirement: Main-thread budget on import

Image decode and preview preparation for import MUST NOT run as blocking work on the main thread. An automated import scenario for a ~24MP JPEG MUST keep LoAF `blockingDuration` within 200 ms.

#### Scenario: Large JPEG import stays within LoAF budget

- **WHEN** a ~24MP JPEG is imported through the photo-card flow in the LoAF scenario test
- **THEN** no recorded LoAF entry has `blockingDuration` greater than 200 ms
